import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normaliseRegistration } from "@/lib/utils";

const schema = z.object({
  type: z.enum([
    "Repair discussion call",
    "Vehicle viewing",
    "Test drive",
    "Sourcing requirements",
    "Blocked time",
  ]),
  staffId: z.string().trim().max(120).optional(),
  date: z.iso.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.coerce.number().int().min(10).max(480),
  customerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  registration: z.string().trim().max(12).optional(),
  internalNote: z.string().trim().max(5000).optional(),
});

const typeMap = {
  "Repair discussion call": {
    slug: "repair-call",
    category: "repair_call",
  },
  "Vehicle viewing": { slug: "vehicle-viewing", category: "viewing" },
  "Test drive": { slug: "test-drive", category: "test_drive" },
  "Sourcing requirements": {
    slug: "sourcing-requirements",
    category: "sales_call",
  },
  "Blocked time": { slug: "blocked-time", category: "internal" },
} as const;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "diary:manage")) {
    return NextResponse.json({ message: "Diary-management access is required." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the appointment details.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const settings = await supabase
    .from("dealership_settings")
    .select("timezone")
    .eq("organisation_id", staff.organisationId)
    .single();
  const timezone = settings.data?.timezone ?? "Europe/London";
  const startsAt = fromZonedTime(
    `${parsed.data.date}T${parsed.data.startTime}:00`,
    timezone,
  );
  const endsAt = addMinutes(startsAt, parsed.data.durationMinutes);
  if (startsAt <= new Date()) {
    return NextResponse.json({ message: "Choose a future appointment time." }, { status: 400 });
  }

  const requestedType = typeMap[parsed.data.type];
  let appointmentType = await supabase
    .from("appointment_types")
    .select("id")
    .eq("organisation_id", staff.organisationId)
    .eq("slug", requestedType.slug)
    .limit(1)
    .maybeSingle();
  if (!appointmentType.data) {
    appointmentType = await supabase
      .from("appointment_types")
      .insert({
        organisation_id: staff.organisationId,
        name: parsed.data.type,
        slug: requestedType.slug,
        category: requestedType.category,
        duration_minutes: parsed.data.durationMinutes,
        default_capacity: 1,
        is_public_bookable: false,
        active: true,
        created_by: staff.userId,
      })
      .select("id")
      .single();
  }
  if (!appointmentType.data) {
    return NextResponse.json(
      { message: "The appointment type could not be configured." },
      { status: 500 },
    );
  }

  let assignedUserId: string | null = null;
  if (parsed.data.staffId) {
    const assigned = await supabase
      .from("organisation_members")
      .select("user_id,profiles(display_name)")
      .eq("organisation_id", staff.organisationId)
      .eq("is_active", true);
    const match = (assigned.data ?? []).find((member) => {
      const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
      return (profile as { display_name?: string } | null)?.display_name === parsed.data.staffId;
    });
    assignedUserId = match?.user_id ?? null;
  }

  const phoneNormalised = parsed.data.phone.replace(/\D/g, "");
  const existingCustomer = await supabase
    .from("customers")
    .select("id")
    .eq("organisation_id", staff.organisationId)
    .eq("phone_normalised", phoneNormalised)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  let customerId = existingCustomer.data?.id as string | undefined;
  if (!customerId) {
    const customer = await supabase
      .from("customers")
      .insert({
        organisation_id: staff.organisationId,
        full_name: parsed.data.customerName,
        phone: parsed.data.phone,
        preferred_contact_method: "phone",
        marketing_consent: false,
        consent_source: "staff_created_appointment",
        created_by: staff.userId,
      })
      .select("id")
      .single();
    if (customer.error || !customer.data) {
      return NextResponse.json({ message: "The customer record could not be saved." }, { status: 500 });
    }
    customerId = customer.data.id;
  }

  const appointment = await supabase
    .from("appointments")
    .insert({
      organisation_id: staff.organisationId,
      appointment_type_id: appointmentType.data.id,
      customer_id: customerId,
      assigned_user_id: assignedUserId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "confirmed",
      reason_for_call: parsed.data.type,
      registration: parsed.data.registration
        ? normaliseRegistration(parsed.data.registration)
        : null,
      internal_notes: parsed.data.internalNote || null,
      created_by: staff.userId,
    })
    .select("id,appointment_type_id,status,starts_at,ends_at")
    .single();
  if (appointment.error) {
    const conflict = appointment.error.code === "23P01" || appointment.error.code === "23505";
    return NextResponse.json(
      {
        message: conflict
          ? "That staff member or slot is already booked."
          : "The appointment could not be saved. No slot was held.",
      },
      { status: conflict ? 409 : 500 },
    );
  }

  return NextResponse.json(
    { ok: true, message: "Appointment created and availability updated.", appointment: appointment.data },
    { status: 201 },
  );
}
