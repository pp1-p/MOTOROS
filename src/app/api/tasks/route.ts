import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(3000).nullable().optional(),
  assignedUserId: z.uuid().nullable().optional(),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  reminderAt: z.iso.datetime({ offset: true }).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  linkedEntityType: z
    .enum([
      "customer",
      "vehicle",
      "lead",
      "sourcing_request",
      "appointment",
      "repair_job",
      "sale",
    ])
    .nullable()
    .optional(),
  linkedEntityId: z.uuid().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "dashboard:view")) {
    return NextResponse.json({ message: "Task access is required." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the task details.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (Boolean(parsed.data.linkedEntityType) !== Boolean(parsed.data.linkedEntityId)) {
    return NextResponse.json(
      { message: "A linked record type and ID must be supplied together." },
      { status: 400 },
    );
  }
  const supabase = createAdminSupabaseClient();
  const linkedColumns: Record<string, unknown> = {};
  if (parsed.data.linkedEntityType && parsed.data.linkedEntityId) {
    const columnByType: Record<string, string> = {
      customer: "customer_id",
      vehicle: "vehicle_id",
      lead: "lead_id",
      sourcing_request: "sourcing_request_id",
      appointment: "appointment_id",
      repair_job: "repair_job_id",
      sale: "sale_id",
    };
    linkedColumns[columnByType[parsed.data.linkedEntityType]!] =
      parsed.data.linkedEntityId;
  }
  const result = await supabase
    .from("tasks")
    .insert({
      organisation_id: staff.organisationId,
      title: parsed.data.title,
      description: parsed.data.description,
      assigned_user_id: parsed.data.assignedUserId ?? staff.userId,
      due_at: parsed.data.dueAt,
      reminder_at: parsed.data.reminderAt,
      priority: parsed.data.priority,
      status: "open",
      ...linkedColumns,
      created_by: staff.userId,
    })
    .select("id,title,status,due_at,priority")
    .single();
  if (result.error) {
    return NextResponse.json({ message: "The task could not be created." }, { status: 500 });
  }
  return NextResponse.json(
    { ok: true, message: "Task created.", task: result.data },
    { status: 201 },
  );
}
