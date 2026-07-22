import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z
  .object({
    method: z.enum([
      "cash",
      "card",
      "bank_transfer",
      "finance_provider",
      "payment_link",
      "cheque",
      "other",
    ]),
    reference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
    paidAt: z.iso.datetime({ offset: true }).optional(),
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
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "invoices:issue_credit")) {
    return NextResponse.json(
      { message: "Recording refunds is not permitted for your role." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { message: "Invalid credit note ID." },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Review the refund details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const result = await supabase.rpc("refund_credit_note", {
    p_actor_user_id: staff.userId,
    p_credit_note_id: id,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference ?? null,
    p_notes: parsed.data.notes ?? null,
    p_paid_at: parsed.data.paidAt ?? new Date().toISOString(),
    p_client_reference: parsed.data.clientReference ?? null,
  });

  if (result.error) {
    if (result.error.code === "42501") {
      return NextResponse.json({ message: "Not authorised." }, { status: 403 });
    }
    if (result.error.code === "P0002") {
      return NextResponse.json(
        { message: "Credit note not found." },
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
      { message: "The refund could not be recorded." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, paymentId: result.data as string },
    { status: 201 },
  );
}
