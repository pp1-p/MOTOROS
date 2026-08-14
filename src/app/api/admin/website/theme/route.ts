import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getTenantEntitlements } from "@/lib/data/tenant-entitlements";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  getWebsiteTheme,
  websiteThemeIds,
} from "@/lib/website/themes";

const schema = z.object({ themeId: z.enum(websiteThemeIds) });

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "website:manage")) {
    return NextResponse.json(
      { message: "Website-editor access is required." },
      { status: 403 },
    );
  }
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { message: "Supabase service access is required to change the website design." },
      { status: 503 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Choose a supported website design." }, { status: 400 });
  }

  const theme = getWebsiteTheme(parsed.data.themeId);
  const entitlements = await getTenantEntitlements(staff.organisationId);
  if (
    theme.requiredEntitlement === "website.themes.premium" &&
    !entitlements.features["website.themes.premium"]
  ) {
    return NextResponse.json(
      { message: `${theme.name} requires the premium website-theme entitlement.` },
      { status: 403 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("dealership_sites")
    .select("id,theme_id,status")
    .eq("organisation_id", staff.organisationId)
    .maybeSingle();
  const result = await supabase
    .from("dealership_sites")
    .upsert(
      {
        organisation_id: staff.organisationId,
        theme_id: theme.id,
        status: existing.data?.status ?? "draft",
        updated_by: staff.userId,
      },
      { onConflict: "organisation_id" },
    )
    .select("id,theme_id,status,updated_at")
    .single();
  if (result.error || !result.data) {
    return NextResponse.json(
      { message: "The website design could not be changed." },
      { status: 500 },
    );
  }

  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    table_name: "dealership_sites",
    record_id: result.data.id,
    action: "website.theme_changed",
    entity_type: "dealership_site",
    entity_id: result.data.id,
    changed_fields: ["theme_id"],
    old_values: { theme_id: existing.data?.theme_id ?? null },
    new_values: { theme_id: result.data.theme_id },
    source: "admin_api",
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/website/themes");
  return NextResponse.json({
    ok: true,
    site: result.data,
    message: `${theme.name} is now the active website design.`,
  });
}
