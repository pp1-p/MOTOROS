import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const saleOptionsSchema = z
  .object({
    issue: z.boolean().optional(),
    due_at: z.iso.datetime({ offset: true }).optional(),
    vat_rate: z.coerce.number().min(0).max(100).optional(),
    vat_treatment: z
      .enum(["standard", "margin", "zero", "exempt", "not_registered"])
      .optional(),
    warranty_price: z.coerce.number().min(0).max(1_000_000).optional(),
    delivery_fee: z.coerce.number().min(0).max(100_000).optional(),
    admin_fee: z.coerce.number().min(0).max(100_000).optional(),
    preparation_fee: z.coerce.number().min(0).max(100_000).optional(),
    additional_products: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(160),
          quantity: z.coerce.number().positive().max(1000).default(1),
          price: z.coerce.number().min(0).max(1_000_000),
          vat_rate: z.coerce.number().min(0).max(100).optional(),
        }),
      )
      .max(50)
      .optional(),
    notes: z.string().trim().max(4000).optional(),
    terms: z.string().trim().max(4000).optional(),
  })
  .strict();

const repairOptionsSchema = z
  .object({
    type: z.enum(["final", "pro_forma", "estimate"]).optional(),
    issue: z.boolean().optional(),
    due_at: z.iso.datetime({ offset: true }).optional(),
    vat_treatment: z
      .enum(["standard", "margin", "zero", "exempt", "not_registered"])
      .optional(),
    notes: z.string().trim().max(4000).optional(),
    terms: z.string().trim().max(4000).optional(),
  })
  .strict();

const createSchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("sale"),
      saleId: z.uuid(),
      options: saleOptionsSchema.optional(),
    })
    .strict(),
  z
    .object({
      source: z.literal("repair"),
      repairJobId: z.uuid(),
      options: repairOptionsSchema.optional(),
    })
    .strict(),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  }

  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json(
      { message: "Sign in is required." },
      { status: 401 },
    );
  }
  if (!hasPermission(staff.role, "invoices:manage")) {
    return NextResponse.json(
      { message: "Invoice creation is not permitted for your role." },
      { status: 403 },
    );
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Review the invoice details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const options = parsed.data.options ?? {};
  const result =
    parsed.data.source === "sale"
      ? await supabase.rpc("create_sale_invoice", {
          p_actor_user_id: staff.userId,
          p_sale_id: parsed.data.saleId,
          p_options: options,
        })
      : await supabase.rpc("create_repair_invoice", {
          p_actor_user_id: staff.userId,
          p_repair_job_id: parsed.data.repairJobId,
          p_options: options,
        });

  if (result.error) {
    if (result.error.code === "23505") {
      return NextResponse.json(
        {
          message:
            parsed.data.source === "sale"
              ? "This sale already has an active invoice."
              : "This repair already has an active final invoice.",
        },
        { status: 409 },
      );
    }
    if (result.error.code === "42501") {
      return NextResponse.json(
        { message: "You are not authorised to invoice this record." },
        { status: 403 },
      );
    }
    if (result.error.code === "P0002") {
      return NextResponse.json(
        {
          message:
            parsed.data.source === "sale"
              ? "The sale could not be found."
              : "The repair job could not be found.",
        },
        { status: 404 },
      );
    }
    if (result.error.code === "22023") {
      return NextResponse.json(
        { message: result.error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "The invoice could not be created. No partial record was saved." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, invoiceId: result.data as string },
    { status: 201 },
  );
}
