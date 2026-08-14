import { NextResponse } from "next/server";
import { z } from "zod";

import { getPlatformAdmin } from "@/lib/auth/platform-admin";
import { assertSameOrigin } from "@/lib/security/request";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const admin = await getPlatformAdmin();
  if (!admin) {
    return NextResponse.json({ message: "Platform administrator access is required." }, { status: 404 });
  }
  if (!admin.canManage) {
    return NextResponse.json(
      { message: "A persistent platform_admin role is required for this action." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Choose a valid dealership status." }, { status: 400 });
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "The dealership ID is invalid." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const result = await supabase.rpc("platform_set_dealership_status", {
    target_organisation_id: id,
    next_status: parsed.data.status,
    reason: parsed.data.reason ?? null,
  });
  if (result.error) {
    return NextResponse.json(
      { message: "The dealership status could not be changed safely." },
      { status: result.error.code === "42501" ? 403 : 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: parsed.data.status,
    message:
      parsed.data.status === "suspended"
        ? "Dealership suspended. Its records have been retained."
        : "Dealership reactivated.",
  });
}
