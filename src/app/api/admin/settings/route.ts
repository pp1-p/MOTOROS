import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  dealershipName: z.string().trim().min(2).max(160).optional(),
  telephone: z.string().trim().min(7).max(30).optional(),
  email: z.email().max(254).optional(),
  address: z.string().trim().min(5).max(1000).optional(),
  timezone: z.string().trim().min(3).max(80).optional(),
  openingHours: z.record(z.string(), z.string().max(200)).optional(),
  socialLinks: z.record(z.string(), z.url().or(z.literal(""))).optional(),
  companyNumber: z.string().trim().max(30).nullable().optional(),
  vatNumber: z.string().trim().max(30).nullable().optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  primaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  heroEyebrow: z.string().trim().max(100).optional(),
  heroTitle: z.string().trim().min(5).max(180).optional(),
  heroBody: z.string().trim().min(10).max(800).optional(),
  dataRetentionMonths: z.coerce.number().int().min(1).max(240).optional(),
  cookieMode: z.enum(["necessary_only", "consent"]).optional(),
});

export async function GET() {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "settings:manage") && !hasPermission(staff.role, "website:manage")) {
    return NextResponse.json({ message: "Settings access is required." }, { status: 403 });
  }
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("dealership_settings")
    .select("*")
    .eq("organisation_id", staff.organisationId)
    .single();
  if (!result.data) return NextResponse.json({ message: "Dealership settings not found." }, { status: 404 });
  return NextResponse.json({ settings: result.data });
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "settings:manage") && !hasPermission(staff.role, "website:manage")) {
    return NextResponse.json({ message: "Settings access is required." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the dealership settings.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const websiteEditorAllowed = new Set([
    "dealershipName",
    "telephone",
    "email",
    "address",
    "openingHours",
    "socialLinks",
    "primaryColour",
    "secondaryColour",
    "heroEyebrow",
    "heroTitle",
    "heroBody",
  ]);
  if (
    staff.role === "website_editor" &&
    Object.keys(parsed.data).some((key) => !websiteEditorAllowed.has(key))
  ) {
    return NextResponse.json({ message: "An owner must change legal or retention settings." }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("dealership_settings")
    .select("*")
    .eq("organisation_id", staff.organisationId)
    .single();
  if (!existing.data) {
    return NextResponse.json({ message: "Dealership settings not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    dealershipName: "dealership_name",
    telephone: "telephone",
    email: "email",
    timezone: "timezone",
    openingHours: "opening_hours",
    socialLinks: "social_links",
    companyNumber: "company_number",
    vatNumber: "vat_number",
    vatRate: "default_vat_rate",
    primaryColour: "brand_primary_colour",
    secondaryColour: "brand_accent_colour",
    dataRetentionMonths: "data_retention_months",
  };
  for (const [key, column] of Object.entries(mapping)) {
    if (key in parsed.data) updates[column] = parsed.data[key as keyof typeof parsed.data];
  }
  if (parsed.data.address !== undefined) {
    updates.address = { formatted: parsed.data.address };
  }
  if (
    parsed.data.heroEyebrow !== undefined ||
    parsed.data.heroTitle !== undefined ||
    parsed.data.heroBody !== undefined
  ) {
    const current =
      existing.data.homepage_wording &&
      typeof existing.data.homepage_wording === "object"
        ? existing.data.homepage_wording
        : {};
    updates.homepage_wording = {
      ...current,
      ...(parsed.data.heroEyebrow !== undefined
        ? { eyebrow: parsed.data.heroEyebrow }
        : {}),
      ...(parsed.data.heroTitle !== undefined
        ? { title: parsed.data.heroTitle }
        : {}),
      ...(parsed.data.heroBody !== undefined
        ? { body: parsed.data.heroBody }
        : {}),
    };
  }
  if (parsed.data.cookieMode !== undefined) {
    updates.cookie_preferences = {
      necessary: true,
      optionalConsentRequired: parsed.data.cookieMode === "consent",
    };
  }
  const result = await supabase
    .from("dealership_settings")
    .update(updates)
    .eq("organisation_id", staff.organisationId)
    .select("*")
    .single();
  if (result.error) return NextResponse.json({ message: "Settings could not be saved." }, { status: 500 });

  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: "dealership_settings.updated",
    entity_type: "dealership_settings",
    entity_id: staff.organisationId,
    old_values: existing.data,
    new_values: result.data,
  });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, message: "Dealership settings saved.", settings: result.data });
}
