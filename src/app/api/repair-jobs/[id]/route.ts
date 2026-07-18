import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import {
  buildTechnicianRepairRpcArguments,
  technicianRepairResponse,
  validateTechnicianRepairUpdate,
} from "@/lib/auth/repair-access";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const repairStatuses = [
  "awaiting_inspection",
  "diagnosing",
  "estimate_preparing",
  "awaiting_customer_approval",
  "approved",
  "parts_ordered",
  "parts_received",
  "work_in_progress",
  "quality_check",
  "ready_for_collection",
  "collected",
  "cancelled",
] as const;

const nullableText = (maximum: number) =>
  z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().trim().max(maximum).nullable().optional(),
  );

const nullableNumber = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().int().min(0).max(2_000_000).nullable().optional(),
);

const nullableUuid = z.preprocess(
  (value) => (value === "" ? null : value),
  z.uuid().nullable().optional(),
);

const nullableDate = z.preprocess(
  (value) => (value === "" ? null : value),
  z.iso.date().nullable().optional(),
);

const schema = z.object({
  status: z.enum(repairStatuses).optional(),
  reportedFault: z.string().trim().min(3).max(5000).optional(),
  diagnosis: nullableText(5000),
  workCompleted: nullableText(5000),
  technicianNotes: nullableText(5000),
  customerFacingNotes: nullableText(5000),
  assignedTechnicianId: nullableUuid,
  mileage: nullableNumber,
  dueDate: nullableDate,
  estimateNet: z.coerce.number().min(0).max(2_000_000).optional(),
  vatAmount: z.coerce.number().min(0).max(2_000_000).optional(),
  approvalStatus: z
    .enum([
      "not_requested",
      "requested",
      "approved",
      "partially_approved",
      "declined",
    ])
    .optional(),
  changeReason: z.string().trim().min(3).max(500),
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
  const canManage = hasPermission(staff.role, "repairs:manage");
  const canUpdateAssigned = hasPermission(staff.role, "technician:update");
  if (!canManage && !canUpdateAssigned) {
    return NextResponse.json({ message: "Repair access is required." }, { status: 403 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid repair job ID." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the repair changes.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (!canManage) {
    const technicianUpdate = validateTechnicianRepairUpdate(parsed.data);
    if (!technicianUpdate.allowed) {
      return NextResponse.json(
        { message: technicianUpdate.message },
        { status: 403 },
      );
    }

    // Use the signed-in user's JWT here, not the service-role client. The RPC
    // locks the repair row, re-checks the assignment and updates only the
    // fields submitted in this request.
    const authenticatedSupabase = await createServerSupabaseClient();
    const result = await authenticatedSupabase.rpc(
      "update_assigned_repair_job",
      buildTechnicianRepairRpcArguments(id, parsed.data),
    );
    if (result.error) {
      if (result.error.code === "42501") {
        return NextResponse.json(
          { message: "Technicians can update only their assigned jobs." },
          { status: 403 },
        );
      }
      if (result.error.code === "22023") {
        return NextResponse.json(
          { message: "Technicians cannot set that repair status." },
          { status: 400 },
        );
      }
      if (result.error.code === "P0002") {
        return NextResponse.json(
          { message: "Repair job not found." },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { message: "The repair job could not be updated." },
        { status: 500 },
      );
    }

    const resultRow = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!resultRow || typeof resultRow !== "object") {
      return NextResponse.json(
        { message: "The repair job could not be updated." },
        { status: 500 },
      );
    }
    const safeRepairJob = technicianRepairResponse(
      resultRow as Record<string, unknown>,
    );

    // Keep the application audit reason without exposing the full repair row
    // in either the audit event or the API response.
    const auditClient = createAdminSupabaseClient();
    await auditClient.from("audit_logs").insert({
      organisation_id: staff.organisationId,
      actor_user_id: staff.userId,
      action: "repair_job.updated",
      entity_type: "repair_job",
      entity_id: id,
      change_reason: parsed.data.changeReason,
      new_values: safeRepairJob,
    });

    return NextResponse.json({
      ok: true,
      message: "Repair job updated.",
      repairJob: safeRepairJob,
    });
  }

  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("repair_jobs")
    .select(
      "id,status,reported_fault,diagnosis,work_completed,technician_notes,customer_facing_notes,mileage,due_date,estimate_net,estimate_vat,approval_status,assigned_technician_id",
    )
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .single();
  if (!existing.data) return NextResponse.json({ message: "Repair job not found." }, { status: 404 });
  if (
    parsed.data.assignedTechnicianId &&
    parsed.data.assignedTechnicianId !== existing.data.assigned_technician_id
  ) {
    const membership = await supabase
      .from("organisation_members")
      .select("id")
      .eq("organisation_id", staff.organisationId)
      .eq("user_id", parsed.data.assignedTechnicianId)
      .eq("role", "technician")
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    if (membership.error || !membership.data) {
      return NextResponse.json(
        { message: "Choose an active technician from this dealership." },
        { status: 400 },
      );
    }
  }

  const updates: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    status: "status",
    reportedFault: "reported_fault",
    diagnosis: "diagnosis",
    workCompleted: "work_completed",
    technicianNotes: "technician_notes",
    customerFacingNotes: "customer_facing_notes",
    assignedTechnicianId: "assigned_technician_id",
    mileage: "mileage",
    dueDate: "due_date",
    estimateNet: "estimate_net",
    vatAmount: "estimate_vat",
    approvalStatus: "approval_status",
  };
  for (const [key, column] of Object.entries(mapping)) {
    if (key in parsed.data) updates[column] = parsed.data[key as keyof typeof parsed.data];
  }
  if (
    parsed.data.estimateNet !== undefined ||
    parsed.data.vatAmount !== undefined
  ) {
    updates.estimate_total =
      Math.round(
        ((parsed.data.estimateNet ?? existing.data.estimate_net ?? 0) +
          (parsed.data.vatAmount ?? existing.data.estimate_vat ?? 0)) *
          100,
      ) / 100;
  }
  if (
    parsed.data.approvalStatus !== undefined &&
    parsed.data.approvalStatus !== existing.data.approval_status
  ) {
    updates.approval_recorded_at =
      parsed.data.approvalStatus === "not_requested" ? null : new Date().toISOString();
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { message: "Choose at least one repair field to update." },
      { status: 400 },
    );
  }
  const result = await supabase
    .from("repair_jobs")
    .update(updates)
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .select("id,reference,status,estimate_net,estimate_vat,approval_status")
    .single();
  if (result.error) {
    return NextResponse.json({ message: "The repair job could not be updated." }, { status: 500 });
  }
  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: "repair_job.updated",
    entity_type: "repair_job",
    entity_id: id,
    change_reason: parsed.data.changeReason,
    old_values: existing.data,
    new_values: result.data,
  });
  return NextResponse.json({ ok: true, message: "Repair job updated.", repairJob: result.data });
}
