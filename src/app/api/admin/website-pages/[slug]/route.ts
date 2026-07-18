import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const slugSchema = z.string().regex(/^[a-z0-9-]{1,100}$/);
const schema = z.object({
  title: z.string().trim().min(2).max(180),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(170).nullable().optional(),
  content: z.record(z.string(), z.unknown()),
  status: z.enum(["draft", "published"]),
  legalReviewRequired: z.boolean().default(false),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
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
  const { slug } = await context.params;
  if (!slugSchema.safeParse(slug).success) {
    return NextResponse.json({ message: "Invalid page slug." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the page content.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("website_pages")
    .upsert(
      {
        organisation_id: staff.organisationId,
        page_type: [
          "about",
          "repairs",
          "contact",
          "privacy",
          "cookies",
          "terms",
        ].includes(slug)
          ? slug
          : slug === "home"
            ? "homepage"
            : "custom",
        slug,
        title: parsed.data.title,
        seo_title: parsed.data.seoTitle,
        seo_description: parsed.data.seoDescription,
        content: parsed.data.content,
        status: parsed.data.status,
        requires_legal_review: parsed.data.legalReviewRequired,
        published_at:
          parsed.data.status === "published" ? new Date().toISOString() : null,
        published_by: parsed.data.status === "published" ? staff.userId : null,
        created_by: staff.userId,
      },
      { onConflict: "organisation_id,slug" },
    )
    .select("id,slug,title,status,published_at,requires_legal_review")
    .single();
  if (result.error) return NextResponse.json({ message: "The page could not be saved." }, { status: 500 });
  return NextResponse.json({
    ok: true,
    message: parsed.data.status === "published" ? "Page published." : "Draft saved.",
    page: result.data,
  });
}
