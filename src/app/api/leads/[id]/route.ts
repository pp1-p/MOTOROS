import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z
  .object({
    status: z
      .enum([
        "new",
        "assigned",
        "contact_attempted",
        "contacted",
        "appointment_booked",
        "qualified",
        "negotiation",
        "deposit_taken",
        "won",
        "lost",
        "spam",
      ])
      .optional(),
    assignedUserId: z.uuid().nullable().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    nextAction: z.string().trim().max(500).nullable().optional(),
    dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
    note: z.string().trim().max(3000).optional(),
    lostReason: z.string().trim().max(500).nullable().optional(),
  })
  .refine((data) => data.status !== "lost" || Boolean(data.lostReason), {
    message: "Record why the lead was lost.",
    path: ["lostReason"],
  });

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
  if (!hasPermission(staff.role, "leads:manage")) {
    return NextResponse.json({ message: "Lead-management access is required." }, { status: 403 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ message: "Invalid lead ID." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the lead changes.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("leads")
    .select("id,assigned_user_id,status,priority")
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .single();
  if (!existing.data) return NextResponse.json({ message: "Lead not found." }, { status: 404 });
  if (
    staff.role === "salesperson" &&
    existing.data.assigned_user_id &&
    existing.data.assigned_user_id !== staff.userId
  ) {
    return NextResponse.json({ message: "This lead is assigned to another salesperson." }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    status: "status",
    assignedUserId: "assigned_user_id",
    priority: "priority",
    nextAction: "next_action",
    dueAt: "due_at",
    lostReason: "lost_reason",
  };
  for (const [key, column] of Object.entries(mapping)) {
    if (key in parsed.data) updates[column] = parsed.data[key as keyof typeof parsed.data];
  }
  const result = await supabase
    .from("leads")
    .update(updates)
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .select("id,status,assigned_user_id,priority,next_action,due_at")
    .single();
  if (result.error) return NextResponse.json({ message: "The lead could not be updated." }, { status: 500 });

  if (parsed.data.note || parsed.data.status) {
    await supabase.from("lead_activities").insert({
      organisation_id: staff.organisationId,
      lead_id: id,
      activity_type: parsed.data.status ? "status_change" : "note",
      summary: parsed.data.status
        ? `Status changed to ${parsed.data.status.replaceAll("_", " ")}`
        : "Internal note added",
      body:
        parsed.data.note ??
        `Status changed to ${parsed.data.status?.replaceAll("_", " ")}.`,
      metadata: parsed.data.status ? { from: existing.data.status, to: parsed.data.status } : {},
      created_by: staff.userId,
    });
  }
  return NextResponse.json({ ok: true, message: "Lead updated.", lead: result.data });
}
