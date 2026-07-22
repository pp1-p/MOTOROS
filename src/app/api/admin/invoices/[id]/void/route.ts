import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({ reason: z.string().trim().min(2).max(1000) }).strict();

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
      { message: "Voiding invoices is not permitted for your role." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid invoice ID." }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "A reason is required to void an invoice.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const result = await supabase.rpc("void_invoice", {
    p_actor_user_id: staff.userId,
    p_invoice_id: id,
    p_reason: parsed.data.reason,
  });

  if (result.error) {
    if (result.error.code === "42501") {
      return NextResponse.json({ message: "Not authorised." }, { status: 403 });
    }
    if (result.error.code === "P0002") {
      return NextResponse.json({ message: "Invoice not found." }, { status: 404 });
    }
    if (result.error.code === "22023") {
      return NextResponse.json(
        { message: result.error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "The invoice could not be voided." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
