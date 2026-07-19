import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getServerEnv } from "@/lib/env";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const roleMap = {
  Owner: "owner",
  Manager: "manager",
  Salesperson: "salesperson",
  "Service advisor": "service_advisor",
  Technician: "technician",
  "Website editor": "website_editor",
} as const;

const schema = z.object({
  email: z.email().max(254),
  role: z.enum(Object.keys(roleMap) as [keyof typeof roleMap, ...(keyof typeof roleMap)[]]),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "team:manage")) {
    return NextResponse.json({ message: "Only an owner can invite team members." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Enter a valid work email and role." }, { status: 400 });

  const supabase = createAdminSupabaseClient();
  const email = parsed.data.email.toLowerCase();
  const existing = await supabase
    .from("organisation_members")
    .select("user_id,invited_email")
    .eq("organisation_id", staff.organisationId);
  if (
    (existing.data ?? []).some(
      (member) => member.invited_email?.toLowerCase() === email,
    )
  ) {
    return NextResponse.json({ message: "That email already belongs to this team." }, { status: 409 });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const inviteRecord = await supabase
    .from("team_invitations")
    .upsert(
      {
        organisation_id: staff.organisationId,
        email,
        role: roleMap[parsed.data.role],
        expires_at: expiresAt,
        invited_by: staff.userId,
        accepted_at: null,
        accepted_by: null,
      },
      { onConflict: "organisation_id,email" },
    )
    .select("id")
    .single();
  if (inviteRecord.error) {
    return NextResponse.json({ message: "The invitation record could not be created." }, { status: 500 });
  }

  const invitation = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getServerEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/admin/accept-invite")}`,
    data: {
      organisation_id: staff.organisationId,
      invited_role: roleMap[parsed.data.role],
      invitation_id: inviteRecord.data.id,
    },
  });
  if (invitation.error) {
    await supabase.from("team_invitations").delete().eq("id", inviteRecord.data.id);
    return NextResponse.json(
      { message: "Supabase Auth could not send the invitation. The pending record was removed." },
      { status: 502 },
    );
  }

  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: "team.invitation_created",
    entity_type: "team_invitation",
    entity_id: inviteRecord.data.id,
    new_values: { emailDomain: email.split("@")[1], role: roleMap[parsed.data.role], expiresAt },
  });
  return NextResponse.json(
    { ok: true, message: "Secure invitation sent and audit event recorded." },
    { status: 201 },
  );
}
