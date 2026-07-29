import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const vehicleSnapshotSchema = z
  .object({
    registration: z.string().trim().max(20).optional(),
    vin: z.string().trim().max(20).optional(),
    make: z.string().trim().max(60).optional(),
    model: z.string().trim().max(80).optional(),
    year: z.union([z.string().trim().max(4), z.number()]).optional(),
    mileage: z.union([z.string().trim().max(10), z.number()]).optional(),
  })
  .strict();

const partExchangeSchema = z
  .object({
    description: z.string().trim().max(300).optional(),
    allowance: z.coerce.number().min(0).max(1_000_000).optional(),
    registration: z.string().trim().max(20).optional(),
    vin: z.string().trim().max(20).optional(),
    mileage: z.union([z.string().trim().max(10), z.number()]).optional(),
  })
  .strict();

const additionalProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().positive().max(1000).default(1),
  price: z.coerce.number().min(0).max(1_000_000),
  vat_rate: z.coerce.number().min(0).max(100).optional(),
});

const saleInvoiceSchema = z
  .object({
    title: z.string().trim().max(160).optional(),
    status: z.enum(["draft", "sent"]).default("draft"),
    customer_id: z.uuid(),
    vehicle_id: z.uuid().nullable().optional(),
    vehicle_snapshot: vehicleSnapshotSchema.optional(),
    issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
    due_at: z.iso.datetime({ offset: true }).nullable().optional(),
    vat_treatment: z
      .enum(["standard", "margin", "zero", "exempt", "not_registered"])
      .default("margin"),
    vat_rate: z.coerce.number().min(0).max(100).optional(),
    show_vat: z.boolean().optional(),
    show_payment_details: z.boolean().default(true),
    sale_price: z.coerce.number().positive().max(10_000_000),
    deposit_paid: z.coerce.number().min(0).max(10_000_000).default(0),
    deposit_method: z
      .enum([
        "cash",
        "card",
        "bank_transfer",
        "finance_provider",
        "payment_link",
        "cheque",
        "deposit_transfer",
        "other",
      ])
      .optional(),
    warranty_price: z.coerce.number().min(0).max(1_000_000).default(0),
    delivery_fee: z.coerce.number().min(0).max(100_000).default(0),
    admin_fee: z.coerce.number().min(0).max(100_000).default(0),
    preparation_fee: z.coerce.number().min(0).max(100_000).default(0),
    part_exchange: partExchangeSchema.optional(),
    additional_products: z.array(additionalProductSchema).max(50).optional(),
    warranty_terms: z.string().trim().max(4000).nullable().optional(),
    payment_method_note: z.string().trim().max(500).nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    terms: z.string().trim().max(4000).nullable().optional(),
  })
  .strict();

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
  if (!hasPermission(staff.role, "invoices:manage")) {
    return NextResponse.json(
      { message: "Invoice creation is not permitted for your role." },
      { status: 403 },
    );
  }

  const parsed = saleInvoiceSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Review the vehicle sale details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const result = await supabase.rpc("create_standalone_sale_invoice", {
    p_actor_user_id: staff.userId,
    p_input: parsed.data,
  });
  if (result.error) {
    return NextResponse.json(
      { message: result.error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ id: result.data as string }, { status: 201 });
}
