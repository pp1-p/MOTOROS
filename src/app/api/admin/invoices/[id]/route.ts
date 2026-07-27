import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    status: z.enum(["draft", "sent"]),
    customer_id: z.uuid(),
    vehicle_id: z.uuid().nullable().optional(),
    issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
    due_at: z.iso.datetime({ offset: true }).nullable().optional(),
    vat_treatment: z.enum(["standard", "zero", "exempt", "not_registered"]),
    show_vat: z.boolean(),
    show_payment_details: z.boolean(),
    notes: z.string().trim().max(4000).nullable().optional(),
    terms: z.string().trim().max(4000).nullable().optional(),
    line_items: z
      .array(
        z.object({
          item_type: z.enum([
            "charge",
            "labour",
            "part",
            "fee",
            "discount",
            "note",
          ]),
          description: z.string().trim().min(1).max(500),
          quantity: z.coerce.number().positive().max(100_000),
          unit_price: z.coerce.number().min(0).max(10_000_000),
          vat_rate: z.coerce.number().min(0).max(100),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "invoices:manage")) {
    return NextResponse.json(
      { message: "Invoice editing is not permitted for your role." },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid invoice ID." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Review the invoice details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await createAdminSupabaseClient().rpc("update_general_invoice", {
    p_actor_user_id: staff.userId,
    p_invoice_id: id,
    p_input: parsed.data,
  });

  if (result.error) {
    if (result.error.code === "42501") {
      return NextResponse.json({ message: "You cannot edit this invoice." }, { status: 403 });
    }
    if (result.error.code === "P0002") {
      return NextResponse.json(
        { message: "The invoice, customer or vehicle could not be found." },
        { status: 404 },
      );
    }
    if (result.error.code === "22023") {
      return NextResponse.json({ message: result.error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: "The invoice could not be updated. No partial edit was saved." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
