import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const paymentSchema = z
  .object({
    amount: z.coerce.number().positive().max(10_000_000),
    method: z.enum([
      "cash",
      "card",
      "bank_transfer",
      "finance_provider",
      "payment_link",
      "cheque",
      "deposit_transfer",
      "other",
    ]),
    paidAt: z.iso.datetime({ offset: true }).optional(),
    reference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
    isRefund: z.boolean().optional(),
    clientReference: z.uuid().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
  if (!hasPermission(staff.role, "invoices:record_payment")) {
    return NextResponse.json(
      { message: "Recording payments is not permitted for your role." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "Invalid invoice ID." },
      { status: 400 },
    );
  }

  const parsed = paymentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Review the payment details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const result = await supabase.rpc("record_invoice_payment", {
    p_actor_user_id: staff.userId,
    p_invoice_id: id,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_paid_at: parsed.data.paidAt ?? new Date().toISOString(),
    p_reference: parsed.data.reference ?? null,
    p_notes: parsed.data.notes ?? null,
    p_is_refund: parsed.data.isRefund ?? false,
    p_client_reference: parsed.data.clientReference ?? null,
  });

  if (result.error) {
    if (result.error.code === "42501") {
      return NextResponse.json(
        { message: "You cannot record payments on invoices." },
        { status: 403 },
      );
    }
    if (result.error.code === "P0002") {
      return NextResponse.json(
        { message: "Invoice not found." },
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
      { message: "The payment could not be recorded." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, paymentId: result.data as string },
    { status: 201 },
  );
}
