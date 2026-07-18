import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
  assignedUserId: z.uuid().nullable().optional(),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  comment: z.string().trim().max(1000).optional(),
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
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid task ID." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid task update." }, { status: 400 });

  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("tasks")
    .select("id,title,assigned_user_id,status,due_at,priority")
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .single();
  if (!existing.data) return NextResponse.json({ message: "Task not found." }, { status: 404 });
  const operationalRole = ["owner", "manager"].includes(staff.role);
  if (existing.data.assigned_user_id !== staff.userId && !operationalRole) {
    return NextResponse.json({ message: "You can update only your assigned tasks." }, { status: 403 });
  }
  if (
    !operationalRole &&
    (["assignedUserId", "dueAt", "priority"] as const).some(
      (field) => field in parsed.data,
    )
  ) {
    return NextResponse.json(
      { message: "Only an owner or manager can reassign or reschedule a task." },
      { status: 403 },
    );
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

  const updates: Record<string, unknown> = {};
  if (parsed.data.status) {
    updates.status = parsed.data.status;
    if (parsed.data.status === "completed") {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = staff.userId;
    } else {
      updates.completed_at = null;
      updates.completed_by = null;
    }
  }
  if (parsed.data.assignedUserId !== undefined) updates.assigned_user_id = parsed.data.assignedUserId;
  if (parsed.data.dueAt !== undefined) updates.due_at = parsed.data.dueAt;
  if (parsed.data.priority) updates.priority = parsed.data.priority;
  let task = existing.data;
  if (Object.keys(updates).length > 0) {
    const result = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .eq("organisation_id", staff.organisationId)
      .select("id,title,assigned_user_id,status,due_at,priority")
      .single();
    if (result.error) {
      return NextResponse.json(
        { message: "The task could not be updated." },
        { status: 500 },
      );
    }
    task = result.data;
  }

  if (parsed.data.comment) {
    await supabase.from("task_comments").insert({
      organisation_id: staff.organisationId,
      task_id: id,
      body: parsed.data.comment,
      created_by: staff.userId,
    });
  }
  return NextResponse.json({ ok: true, message: "Task updated.", task });
}
