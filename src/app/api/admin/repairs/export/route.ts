import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "repairs:view")) {
    return NextResponse.json({ message: "Repair access is required." }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("repair_jobs")
    .select(
      "id,reference,customer_id,assigned_technician_id,status,registration,vehicle_make_model,mileage,reported_fault,diagnosis,work_completed,estimate_net,estimate_vat,estimate_total,approval_status,payment_status,start_date,due_date,collection_date,created_at",
    )
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (staff.role === "technician") {
    query = query.eq("assigned_technician_id", staff.userId);
  }
  const jobs = await query;
  if (jobs.error) {
    return NextResponse.json({ message: "Repairs export failed." }, { status: 500 });
  }

  const customerIds = [
    ...new Set((jobs.data ?? []).map((job) => job.customer_id)),
  ];
  const technicianIds = [
    ...new Set(
      (jobs.data ?? [])
        .map((job) => job.assigned_technician_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const [customersResult, profilesResult] = await Promise.all([
    customerIds.length
      ? supabase
          .from("customers")
          .select("id,full_name,first_name,last_name,email,phone")
          .eq("organisation_id", staff.organisationId)
          .in("id", customerIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    technicianIds.length
      ? supabase
          .from("profiles")
          .select("id,display_name,full_name")
          .in("id", technicianIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (customersResult.error || profilesResult.error) {
    return NextResponse.json({ message: "Repairs export failed." }, { status: 500 });
  }

  const customers = new Map(
    (customersResult.data ?? []).map((customer) => [customer.id, customer]),
  );
  const technicians = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.id,
      profile.display_name ?? profile.full_name ?? "Team member",
    ]),
  );
  const rows = (jobs.data ?? []).map((job) => {
    const customer = customers.get(job.customer_id);
    return {
      reference: job.reference,
      customer:
        customer?.full_name ??
        [customer?.first_name, customer?.last_name].filter(Boolean).join(" "),
      customer_email: customer?.email ?? "",
      customer_phone: customer?.phone ?? "",
      registration: job.registration ?? "",
      vehicle: job.vehicle_make_model ?? "",
      mileage: job.mileage ?? "",
      status: job.status,
      reported_fault: job.reported_fault,
      diagnosis: job.diagnosis ?? "",
      work_completed: job.work_completed ?? "",
      technician: job.assigned_technician_id
        ? (technicians.get(job.assigned_technician_id) ?? "Team member")
        : "Unassigned",
      estimate_net: job.estimate_net,
      estimate_vat: job.estimate_vat,
      estimate_total: job.estimate_total,
      approval_status: job.approval_status,
      payment_status: job.payment_status,
      start_date: job.start_date ?? "",
      due_date: job.due_date ?? "",
      collection_date: job.collection_date ?? "",
      created_at: job.created_at,
    };
  });
  const headers = rows.length
    ? Object.keys(rows[0]!)
    : [
        "reference",
        "customer",
        "registration",
        "vehicle",
        "status",
        "reported_fault",
      ];
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      headers
        .map((header) => csvCell(row[header as keyof typeof row]))
        .join(","),
    ),
  ].join("\r\n");

  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: "repair_jobs.exported",
    entity_type: "repair_job",
    change_reason: `Exported ${rows.length} repair jobs`,
  });

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dealeros-repairs-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
