import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z
  .object({
    warranty_terms: z.string().trim().max(4000).nullable().optional(),
    payment_method_note: z.string().trim().max(500).nullable().optional(),
    part_exchange: z
      .object({
        description: z.string().trim().max(300).nullable().optional(),
        allowance: z
          .union([z.coerce.number().min(0).max(1_000_000), z.literal("")])
          .optional()
          .transform((value) =>
            value === "" || value === undefined ? undefined : value,
          ),
        registration: z.string().trim().max(20).nullable().optional(),
        mileage: z.string().trim().max(10).nullable().optional(),
      })
      .strict()
      .optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    terms: z.string().trim().max(4000).nullable().optional(),
  })
  .strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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
  if (!hasPermission(staff.role, "invoices:manage")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Please check the highlighted fields",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  const result = await supabase.rpc("update_sale_invoice_details", {
    p_actor_user_id: staff.userId,
    p_invoice_id: id,
    p_input: parsed.data,
  });
  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
