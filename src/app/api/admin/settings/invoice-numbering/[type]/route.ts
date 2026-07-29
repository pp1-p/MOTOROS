import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(1, "Prefix is required")
    .max(8, "Prefix must be 8 characters or fewer")
    .regex(/^[A-Za-z0-9-]+$/, "Letters, digits and hyphen only")
    .transform((value) => value.toUpperCase()),
  next_number: z.coerce.number().int().min(1).max(99_999_999),
  digits: z.coerce.number().int().min(1).max(9),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  }

  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in required" }, { status: 401 });
  }
  if (!hasPermission(staff.role, "settings:manage")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { type } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Please check the highlighted fields",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const update = await supabase
    .from("invoice_number_sequences")
    .update({
      prefix: parsed.data.prefix,
      next_number: parsed.data.next_number,
      digits: parsed.data.digits,
    })
    .eq("organisation_id", staff.organisationId)
    .eq("type", type)
    .select("type")
    .maybeSingle();

  if (update.error) {
    return NextResponse.json({ message: update.error.message }, { status: 500 });
  }
  if (!update.data) {
    return NextResponse.json({ message: "Sequence not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
