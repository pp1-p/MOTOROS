import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
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

  const supabase = createAdminSupabaseClient();
  const result = await supabase.rpc("publish_homepage", {
    p_organisation_id: staff.organisationId,
    p_actor_user_id: staff.userId,
  });

  if (result.error) {
    const incomplete =
      result.error.code === "22023" ||
      result.error.code === "P0002" ||
      result.error.message.toLowerCase().includes("draft");
    return NextResponse.json(
      {
        message: incomplete
          ? "Save a complete homepage draft before publishing."
          : "The homepage could not be published. The live website is unchanged.",
      },
      { status: incomplete ? 422 : 500 },
    );
  }

  revalidatePath("/", "layout");
  return NextResponse.json({
    ok: true,
    message: "Homepage published. The public website now uses this content.",
    publication: result.data,
  });
}
