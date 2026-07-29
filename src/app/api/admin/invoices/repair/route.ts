import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const lineItemSchema = z.object({
  item_type: z.enum(["charge", "labour", "part", "fee", "discount", "note"]),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().max(100_000),
  unit_price: z.coerce.number().min(0).max(10_000_000),
  vat_rate: z.coerce.number().min(0).max(100),
  repair_code_id: z.uuid().nullable().optional(),
});

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

const repairInvoiceSchema = z
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
      .default("standard"),
    show_vat: z.boolean().default(true),
    show_payment_details: z.boolean().default(true),
    notes: z.string().trim().max(4000).nullable().optional(),
    terms: z.string().trim().max(4000).nullable().optional(),
    reported_fault: z.string().trim().max(4000).nullable().optional(),
    diagnosis: z.string().trim().max(4000).nullable().optional(),
    work_completed: z.string().trim().max(4000).nullable().optional(),
    technician_notes: z.string().trim().max(4000).nullable().optional(),
    recommendations: z.string().trim().max(4000).nullable().optional(),
    warranty: z.string().trim().max(2000).nullable().optional(),
    line_items: z.array(lineItemSchema).min(1).max(100),
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

  const parsed = repairInvoiceSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Review the repair invoice details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const result = await supabase.rpc("create_standalone_repair_invoice", {
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
