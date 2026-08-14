import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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
  if (
    !hasPermission(staff.role, "social:view") ||
    !hasPermission(staff.role, "leads:manage")
  ) {
    return NextResponse.json(
      { message: "Lead-management access is required." },
      { status: 403 },
    );
  }
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { message: "Supabase service access is required to create an attributed lead." },
      { status: 503 },
    );
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "The conversation ID is invalid." }, { status: 400 });
  }

  const result = await createAdminSupabaseClient().rpc(
    "convert_social_conversation_to_lead",
    {
      target_organisation_id: staff.organisationId,
      target_conversation_id: id,
      actor_user_id: staff.userId,
    },
  );
  if (result.error || !result.data) {
    return NextResponse.json(
      {
        message:
          result.error?.code === "P0002"
            ? "The conversation was not found in this dealership."
            : "The conversation could not be converted safely.",
      },
      { status: result.error?.code === "P0002" ? 404 : 500 },
    );
  }

  const leadId = String(result.data);
  revalidatePath("/admin/social");
  revalidatePath("/admin/social/inbox");
  revalidatePath("/admin/leads");
  return NextResponse.json({
    ok: true,
    leadId,
    message: "Lead created with the original channel attribution.",
  });
}
