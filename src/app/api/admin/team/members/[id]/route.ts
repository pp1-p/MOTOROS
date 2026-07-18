import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  role: z.enum([
    "owner",
    "manager",
    "salesperson",
    "service_advisor",
    "technician",
    "website_editor",
  ]),
  status: z.enum(["active", "suspended"]),
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
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "team:manage")) {
    return NextResponse.json(
      { message: "Only an owner can change team access." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid team member ID." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Choose a valid role and status." }, { status: 400 });
  }
  if (id === staff.userId && parsed.data.status !== "active") {
    return NextResponse.json(
      { message: "You cannot deactivate your own owner account." },
      { status: 409 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const update = await supabase.rpc("update_team_member_access", {
    p_organisation_id: staff.organisationId,
    p_target_user_id: id,
    p_role: parsed.data.role,
    p_status: parsed.data.status,
    p_actor_user_id: staff.userId,
  });
  const member = update.data as
    | { user_id: string; role: string; status: string }
    | null;
  if (update.error || !member) {
    const notFound = update.error?.code === "P0002";
    const forbidden = update.error?.code === "42501";
    const conflict = update.error?.code === "23514";
    return NextResponse.json(
      {
        message: notFound
          ? "Team member not found."
          : forbidden
            ? "Only an active owner can change team access."
            : conflict
          ? update.error?.message
          : "Team access could not be updated.",
      },
      { status: notFound ? 404 : forbidden ? 403 : conflict ? 409 : 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    message: "Team role and access status updated.",
    member,
  });
}
