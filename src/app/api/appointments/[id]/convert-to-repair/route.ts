import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  mileage: z.coerce.number().int().min(0).max(2_000_000).optional().nullable(),
  assignedTechnicianId: z.uuid().optional().nullable(),
  dueDate: z.iso.datetime({ offset: true }).optional().nullable(),
  internalNote: z.string().trim().max(3000).optional().nullable(),
});

export async function POST(
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
  if (!hasPermission(staff.role, "repairs:manage")) {
    return NextResponse.json({ message: "Repair-management access is required." }, { status: 403 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid appointment ID." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the repair details.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const repair = await supabase.rpc("convert_appointment_to_repair", {
    p_organisation_id: staff.organisationId,
    p_appointment_id: id,
    p_actor_user_id: staff.userId,
    p_mileage: parsed.data.mileage ?? null,
    p_assigned_technician_id: parsed.data.assignedTechnicianId ?? null,
    p_due_date: parsed.data.dueDate?.slice(0, 10) ?? null,
    p_internal_note: parsed.data.internalNote ?? null,
  });
  const repairJob = repair.data as
    | {
        id: string;
        reference: string;
        status: string;
        already_exists: boolean;
      }
    | null;

  if (repair.error || !repairJob) {
    const notFound = repair.error?.code === "P0002";
    const invalidRelationship = ["23503", "23514"].includes(
      repair.error?.code ?? "",
    );
    return NextResponse.json(
      {
        message: notFound
          ? "Appointment not found."
          : invalidRelationship
          ? repair.error?.message ??
            "Review the customer and technician before converting this appointment."
          : "The repair job could not be created. The appointment was unchanged.",
      },
      { status: notFound ? 404 : invalidRelationship ? 422 : 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: repairJob.already_exists
        ? "This appointment is already linked to a repair job."
        : "Repair job created.",
      repairJob,
    },
    { status: repairJob.already_exists ? 200 : 201 },
  );
}
