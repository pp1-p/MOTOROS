import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z
  .object({
    password: z
      .string()
      .min(12)
      .max(128)
      .regex(/[a-z]/, "Use a lowercase letter.")
      .regex(/[A-Z]/, "Use an uppercase letter.")
      .regex(/[0-9]/, "Use a number.")
      .regex(/[^A-Za-z0-9]/, "Use a symbol."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.issues[0]?.message ??
          "Use a strong password and confirm it.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { message: "This invitation session has expired. Ask for a new invitation." },
      { status: 401 },
    );
  }

  const invitationId =
    typeof user.user_metadata?.invitation_id === "string"
      ? user.user_metadata.invitation_id
      : "";
  if (!z.uuid().safeParse(invitationId).success || !user.email) {
    return NextResponse.json(
      { message: "This invitation is invalid. Ask the dealership owner to send a new one." },
      { status: 410 },
    );
  }

  const admin = createAdminSupabaseClient();
  const invitation = await admin
    .from("team_invitations")
    .select("id,email,expires_at,accepted_at")
    .eq("id", invitationId)
    .maybeSingle();
  const invitationValid =
    invitation.data &&
    !invitation.data.accepted_at &&
    new Date(invitation.data.expires_at).getTime() > Date.now() &&
    invitation.data.email.toLowerCase() === user.email.toLowerCase();
  if (!invitationValid) {
    return NextResponse.json(
      { message: "This invitation is invalid or has expired. Ask the dealership owner to send a new one." },
      { status: 410 },
    );
  }

  const passwordUpdate = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (passwordUpdate.error) {
    return NextResponse.json(
      { message: "Your password could not be saved. Please try again." },
      { status: 422 },
    );
  }

  const accepted = await admin.rpc("accept_team_invitation", {
    p_user_id: user.id,
  });
  if (accepted.error) {
    const expired =
      accepted.error.code === "P0002" ||
      accepted.error.message.toLowerCase().includes("invitation");
    return NextResponse.json(
      {
        message: expired
          ? "This invitation is invalid or has expired. Ask the dealership owner to send a new one."
          : "Your account could not be added to the dealership. No access was granted.",
      },
      { status: expired ? 410 : 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Invitation accepted. Opening DealerOS…",
    redirectTo: "/admin",
  });
}
