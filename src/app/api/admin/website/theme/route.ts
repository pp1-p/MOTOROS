import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { THEME_IDS } from "@/lib/themes";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({ themeId: z.enum(THEME_IDS) });

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "website:manage")) {
    return NextResponse.json({ message: "Website-editor access is required." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Choose one of the available website designs." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const current = await supabase
    .from("dealership_settings")
    .select("draft_theme_id,published_theme_id")
    .eq("organisation_id", staff.organisationId)
    .single();
  if (current.error || !current.data) {
    return NextResponse.json({ message: "Dealership website settings were not found." }, { status: 404 });
  }
  const update = await supabase
    .from("dealership_settings")
    .update({ draft_theme_id: parsed.data.themeId })
    .eq("organisation_id", staff.organisationId)
    .select("draft_theme_id,published_theme_id")
    .single();
  if (update.error || !update.data) {
    return NextResponse.json({ message: "The draft website design could not be saved." }, { status: 500 });
  }
  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: "website.theme_draft_selected",
    entity_type: "dealership_settings",
    entity_id: staff.organisationId,
    old_values: { draft_theme_id: current.data.draft_theme_id },
    new_values: { draft_theme_id: update.data.draft_theme_id },
    source: "application",
  });
  return NextResponse.json({
    ok: true,
    message: "Design selected as the draft. The live website is unchanged.",
    theme: update.data,
  });
}
