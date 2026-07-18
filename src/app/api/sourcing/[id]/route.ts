import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const sourcingStatuses = [
  "new",
  "contact_attempted",
  "requirements_confirmed",
  "search_active",
  "options_found",
  "option_sent",
  "inspection_required",
  "negotiation",
  "deposit_requested",
  "vehicle_secured",
  "preparing_vehicle",
  "completed",
  "paused",
  "lost",
] as const;

const schema = z.object({
  status: z.enum(sourcingStatuses).optional(),
  assignedUserId: z.uuid().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  note: z.string().trim().max(3000).optional(),
  sourcingFee: z.coerce.number().min(0).max(1_000_000).optional(),
  expectedMargin: z.coerce.number().min(-1_000_000).max(1_000_000).optional(),
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
  if (!hasPermission(staff.role, "sourcing:manage")) {
    return NextResponse.json({ message: "Sourcing-management access is required." }, { status: 403 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid sourcing request ID." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the sourcing changes.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const changes: Record<string, unknown> = {};
  for (const key of [
    "status",
    "assignedUserId",
    "priority",
    "sourcingFee",
    "expectedMargin",
  ] as const) {
    if (key in parsed.data) changes[key] = parsed.data[key];
  }
  if (changes.status === "option_sent") changes.status = "option_sent_to_customer";
  const supabase = createAdminSupabaseClient();
  const result = await supabase.rpc("update_sourcing_request", {
    p_organisation_id: staff.organisationId,
    p_sourcing_request_id: id,
    p_changes: changes,
    p_note: parsed.data.note,
    p_actor_user_id: staff.userId,
  });
  if (result.error) {
    return NextResponse.json(
      { message: "The sourcing request could not be updated. No partial change was accepted." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, message: "Sourcing request updated.", sourcing: result.data });
}
