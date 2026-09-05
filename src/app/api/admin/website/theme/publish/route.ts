import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { THEME_IDS } from "@/lib/themes";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({ themeId: z.enum(THEME_IDS) });

export async function POST(request: Request) {
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
    return NextResponse.json({ message: "Choose a valid draft design before publishing." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const settings = await supabase
    .from("dealership_settings")
    .select("draft_theme_id,published_theme_id")
    .eq("organisation_id", staff.organisationId)
    .single();
  if (settings.error || !settings.data) {
    return NextResponse.json({ message: "Dealership website settings were not found." }, { status: 404 });
  }
  if (settings.data.draft_theme_id !== parsed.data.themeId) {
    return NextResponse.json({ message: "Select this design as the draft before publishing it." }, { status: 409 });
  }
  const publication = await supabase.rpc("publish_website_theme", {
    p_organisation_id: staff.organisationId,
    p_theme_id: parsed.data.themeId,
  });
  if (publication.error) {
    return NextResponse.json({ message: "The design could not be published. The live website is unchanged." }, { status: 500 });
  }
  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: "website.theme_published",
    entity_type: "dealership_settings",
    entity_id: staff.organisationId,
    old_values: { published_theme_id: settings.data.published_theme_id },
    new_values: {
      published_theme_id: parsed.data.themeId,
      publication_id: publication.data,
    },
    source: "application",
  });
  revalidatePath("/", "layout");
  revalidatePath("/cars");
  return NextResponse.json({
    ok: true,
    message: "Website design published successfully.",
    publication: publication.data,
  });
}
