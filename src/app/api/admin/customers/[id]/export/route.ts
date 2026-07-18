import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!["owner", "manager"].includes(staff.role)) {
    return NextResponse.json(
      { message: "Customer data exports require owner or manager access." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid customer ID." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const customer = await supabase
    .from("customers")
    .select(
      "id,full_name,email,phone,address,preferred_contact_method,marketing_consent,consent_at,consent_source,created_at,updated_at",
    )
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .single();
  if (!customer.data) return NextResponse.json({ message: "Customer not found." }, { status: 404 });

  const [vehicles, leads, sourcing, appointments, repairs, sales, tasks, documents] =
    await Promise.all([
      supabase
        .from("customer_vehicles")
        .select("id,registration,make,model,year,current_mileage,created_at")
        .eq("customer_id", id)
        .eq("organisation_id", staff.organisationId),
      supabase
        .from("leads")
        .select("id,lead_type,status,title,source,created_at,updated_at")
        .eq("customer_id", id)
        .eq("organisation_id", staff.organisationId),
      supabase
        .from("sourcing_requests")
        .select(
          "id,status,preferred_make,preferred_model,minimum_year,maximum_mileage,budget,desired_timescale,created_at,updated_at",
        )
        .eq("customer_id", id)
        .eq("organisation_id", staff.organisationId),
      supabase
        .from("appointments")
        .select(
          "id,status,starts_at,ends_at,reason_for_call,registration,created_at,appointment_types(name,category)",
        )
        .eq("customer_id", id)
        .eq("organisation_id", staff.organisationId),
      supabase
        .from("repair_jobs")
        .select(
          "id,reference,status,registration,vehicle_make_model,reported_fault,diagnosis,customer_facing_notes,start_date,due_date,collection_date",
        )
        .eq("customer_id", id)
        .eq("organisation_id", staff.organisationId),
      supabase
        .from("staff_sales_records")
        .select("id,vehicle_id,sale_price,sale_date,handover_date,warranty,created_at")
        .eq("customer_id", id)
        .eq("organisation_id", staff.organisationId),
      supabase
        .from("tasks")
        .select("id,title,status,due_at,completed_at")
        .eq("customer_id", id)
        .eq("organisation_id", staff.organisationId),
      supabase
        .from("documents")
        .select("id,file_name,mime_type,size_bytes,created_at")
        .eq("entity_type", "customer")
        .eq("entity_id", id)
        .eq("organisation_id", staff.organisationId),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    exportScope:
      "Customer-facing personal data. Internal staff notes and commercially sensitive costs are excluded.",
    customer: customer.data,
    vehicles: vehicles.data ?? [],
    leads: leads.data ?? [],
    sourcingRequests: sourcing.data ?? [],
    appointments: appointments.data ?? [],
    repairJobs: repairs.data ?? [],
    sales: sales.data ?? [],
    tasks: tasks.data ?? [],
    documentMetadata: documents.data ?? [],
  };

  await createAdminSupabaseClient().from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: "customer.data_exported",
    entity_type: "customer",
    entity_id: id,
  });

  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="customer-data-${id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
