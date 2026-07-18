import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const statusValues = [
  "requested",
  "confirmed",
  "assigned",
  "call_completed",
  "repair_estimate_required",
  "workshop_appointment_required",
  "customer_unavailable",
  "cancelled",
  "no_show",
  "closed",
] as const;

const schema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }).optional(),
    endsAt: z.iso.datetime({ offset: true }).optional(),
    assignedUserId: z.uuid().nullable().optional(),
    status: z.enum(statusValues).optional(),
    internalNotes: z.string().trim().max(5000).nullable().optional(),
    cancellationReason: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    (data) => !data.startsAt || !data.endsAt || new Date(data.endsAt) > new Date(data.startsAt),
    { message: "Appointment end time must be after its start time.", path: ["endsAt"] },
  )
  .refine(
    (data) => data.status !== "cancelled" || Boolean(data.cancellationReason),
    { message: "A cancellation reason is required.", path: ["cancellationReason"] },
  );

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid appointment ID." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the appointment changes.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const mapping: Record<string, string> = {
    startsAt: "starts_at",
    endsAt: "ends_at",
    assignedUserId: "assigned_user_id",
    status: "status",
    internalNotes: "internal_notes",
    cancellationReason: "cancellation_reason",
  };
  const updates: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(mapping)) {
    if (key in parsed.data) updates[column] = parsed.data[key as keyof typeof parsed.data];
  }
  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("appointments")
    .select("id,starts_at,ends_at,status,assigned_user_id")
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .single();
  if (!existing.data) return NextResponse.json({ message: "Appointment not found." }, { status: 404 });

  if (staff.role === "salesperson") {
    if (existing.data.assigned_user_id !== staff.userId) {
      return NextResponse.json(
        { message: "You can update only appointments assigned to you." },
        { status: 403 },
      );
    }
    if (
      parsed.data.assignedUserId !== undefined &&
      parsed.data.assignedUserId !== staff.userId
    ) {
      return NextResponse.json(
        { message: "Salespeople cannot reassign appointments." },
        { status: 403 },
      );
    }
  }

  if (parsed.data.assignedUserId) {
    const assignee = await supabase
      .from("organisation_members")
      .select("user_id")
      .eq("organisation_id", staff.organisationId)
      .eq("user_id", parsed.data.assignedUserId)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    if (assignee.error || !assignee.data) {
      return NextResponse.json(
        { message: "Choose an active team member from this dealership." },
        { status: 400 },
      );
    }
  }

  const result = await supabase
    .from("appointments")
    .update(updates)
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .select("id,starts_at,ends_at,status,assigned_user_id")
    .single();
  if (result.error) {
    const conflict = result.error.code === "23P01" || result.error.code === "23505";
    return NextResponse.json(
      {
        message: conflict
          ? "That time conflicts with another appointment."
          : "The appointment could not be updated.",
      },
      { status: conflict ? 409 : 500 },
    );
  }
  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: "appointment.updated",
    entity_type: "appointment",
    entity_id: id,
    old_values: existing.data,
    new_values: result.data,
  });
  return NextResponse.json({ ok: true, message: "Appointment updated.", appointment: result.data });
}
