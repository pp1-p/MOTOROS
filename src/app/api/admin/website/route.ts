import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  heroEyebrow: z.string().trim().min(2).max(100),
  heroHeading: z.string().trim().min(5).max(180),
  heroBody: z.string().trim().min(10).max(800),
  primaryLabel: z.string().trim().min(2).max(80),
  primaryHref: z.string().trim().regex(/^\/[a-z0-9/?=&_-]*$/i),
  heroImageAlt: z.string().trim().min(5).max(240),
  seoTitle: z.string().trim().min(5).max(70),
  seoDescription: z.string().trim().min(20).max(170),
});

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
    return NextResponse.json(
      { message: "Review the homepage content.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("website_pages")
    .upsert(
      {
        organisation_id: staff.organisationId,
        page_type: "homepage",
        slug: "home",
        title: "Homepage",
        seo_title: parsed.data.seoTitle,
        seo_description: parsed.data.seoDescription,
        content: {
          hero: {
            eyebrow: parsed.data.heroEyebrow,
            heading: parsed.data.heroHeading,
            body: parsed.data.heroBody,
            primaryLabel: parsed.data.primaryLabel,
            primaryHref: parsed.data.primaryHref,
            imageAlt: parsed.data.heroImageAlt,
          },
        },
        status: "draft",
        created_by: staff.userId,
      },
      { onConflict: "organisation_id,slug" },
    )
    .select("id,slug,status,updated_at")
    .single();
  if (result.error) return NextResponse.json({ message: "The homepage draft could not be saved." }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Homepage draft saved. The live website is unchanged.", page: result.data });
}
