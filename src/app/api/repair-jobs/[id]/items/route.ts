import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  createRepairItemSchema,
  updateRepairItemSchema,
  removeRepairItemSchema,
  repairItemValues,
} from "@/lib/validation/repair-items";

const columns =
  "id,item_type,description,quantity,unit_price,vat_rate,line_total,status,supplier,part_number,updated_at";
type Context = { params: Promise<{ id: string }> };
type Operation = "create" | "update" | "remove";

async function mutate(
  request: Request,
  context: Context,
  operation: Operation,
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  }
  const staff = await getStaffContext();
  if (!staff)
    return NextResponse.json(
      { message: "Sign in is required." },
      { status: 401 },
    );
  if (!hasPermission(staff.role, "repairs:manage")) {
    return NextResponse.json(
      { message: "Repair management permission is required." },
      { status: 403 },
    );
  }
  const { id: jobId } = await context.params;
  if (!z.uuid().safeParse(jobId).success)
    return NextResponse.json(
      { message: "Invalid repair job ID." },
      { status: 400 },
    );
  const schema =
    operation === "create"
      ? createRepairItemSchema
      : operation === "update"
        ? updateRepairItemSchema
        : removeRepairItemSchema;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Review the item details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const client = createAdminSupabaseClient();
    const job = await client
      .from("repair_jobs")
      .select("id,status")
      .eq("id", jobId)
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (job.error)
      return NextResponse.json(
        { message: "The repair job could not be checked." },
        { status: 500 },
      );
    if (!job.data)
      return NextResponse.json(
        { message: "Repair job not found." },
        { status: 404 },
      );
    if (["collected", "cancelled"].includes(job.data.status)) {
      return NextResponse.json(
        { message: "Reopen this repair job before changing its items." },
        { status: 409 },
      );
    }
    const itemId = parsed.data.id;
    const scopedItem = () =>
      client
        .from("repair_job_items")
        .select(columns)
        .eq("id", itemId)
        .eq("repair_job_id", jobId)
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .maybeSingle();
    const action =
      operation === "remove"
        ? "removed"
        : operation === "create"
          ? "created"
          : "updated";
    let saved;
    if (operation === "create") {
      const item = createRepairItemSchema.parse(parsed.data);
      const values = repairItemValues(item);
      const result = await client
        .from("repair_job_items")
        .insert({
          ...values,
          id: itemId,
          repair_job_id: jobId,
          organisation_id: staff.organisationId,
          created_by: staff.userId,
        })
        .select(columns)
        .single();
      if (result.error?.code === "23505") {
        // A repeated submission uses the same client-generated ID. Do not upsert
        // or revive a removed row, and do not accept a different job's ID.
        const existing = await scopedItem();
        if (existing.error)
          return NextResponse.json(
            {
              message:
                "The previous save could not be checked. Refresh this job before trying again.",
            },
            { status: 500 },
          );
        const row = existing.data as Record<string, unknown> | null;
        if (
          row &&
          Object.entries(values).every(([key, value]) => row[key] === value)
        ) {
          return NextResponse.json({
            ok: true,
            item: existing.data,
            message: "This item is already saved. No duplicate was created.",
          });
        }
        return NextResponse.json(
          {
            message:
              "This item ID is already in use. Refresh this job before adding another item.",
          },
          { status: 409 },
        );
      }
      if (result.error || !result.data)
        return NextResponse.json(
          {
            message:
              "The item save was not confirmed. Refresh this job before trying again.",
          },
          { status: 500 },
        );
      saved = result.data;
    } else {
      const item =
        operation === "update"
          ? updateRepairItemSchema.parse(parsed.data)
          : removeRepairItemSchema.parse(parsed.data);
      const existing = await scopedItem();
      if (existing.error)
        return NextResponse.json(
          { message: "The item could not be checked." },
          { status: 500 },
        );
      if (!existing.data)
        return NextResponse.json(
          { message: "Repair item not found." },
          { status: 404 },
        );
      if (!["labour", "part"].includes(existing.data.item_type)) {
        return NextResponse.json(
          { message: "Only labour and parts can be changed here." },
          { status: 400 },
        );
      }
      const values =
        operation === "remove"
          ? { deleted_at: new Date().toISOString() }
          : repairItemValues(updateRepairItemSchema.parse(item));
      const result = await client
        .from("repair_job_items")
        .update(values)
        .eq("id", itemId)
        .eq("repair_job_id", jobId)
        .eq("organisation_id", staff.organisationId)
        .eq("updated_at", item.expectedUpdatedAt)
        .is("deleted_at", null)
        .select(columns)
        .maybeSingle();
      if (result.error)
        return NextResponse.json(
          {
            message:
              "The item change was not confirmed. Refresh this job before trying again.",
          },
          { status: 500 },
        );
      if (!result.data)
        return NextResponse.json(
          {
            message:
              "This item changed since you opened it. Refresh the job and review the latest version.",
          },
          { status: 409 },
        );
      saved = result.data;
    }
    let auditFailed = false;
    try {
      const audit = await client.from("audit_logs").insert({
        organisation_id: staff.organisationId,
        actor_user_id: staff.userId,
        action: `repair_job.item_${action}`,
        entity_type: "repair_job",
        entity_id: jobId,
        change_reason: parsed.data.changeReason,
        new_values: { item_id: itemId, operation: action },
      });
      auditFailed = Boolean(audit.error);
    } catch {
      auditFailed = true;
    }
    return NextResponse.json(
      {
        ok: true,
        item: saved,
        message: auditFailed
          ? `Item ${action}, but its activity could not be recorded. Contact the owner; do not submit it again.`
          : `Item ${action}.`,
        ...(auditFailed ? { warning: "audit_unavailable" } : {}),
      },
      { status: operation === "create" ? 201 : 200 },
    );
  } catch {
    return NextResponse.json(
      {
        message:
          "The server did not confirm this change. Refresh the job before trying again; it may already have saved.",
      },
      { status: 500 },
    );
  }
}

export function POST(request: Request, context: Context) {
  return mutate(request, context, "create");
}
export function PATCH(request: Request, context: Context) {
  return mutate(request, context, "update");
}
export function DELETE(request: Request, context: Context) {
  return mutate(request, context, "remove");
}
