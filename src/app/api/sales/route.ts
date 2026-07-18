import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  vehicleId: z.uuid(),
  customerId: z.uuid(),
  salespersonId: z.uuid().optional(),
  salePrice: z.coerce.number().positive().max(20_000_000),
  deposit: z.coerce.number().min(0).max(20_000_000).default(0),
  partExchangeAllowance: z.coerce.number().min(0).max(20_000_000).default(0),
  discount: z.coerce.number().min(0).max(20_000_000).default(0),
  warranty: z.string().trim().max(1000).nullable().optional(),
  additionalProducts: z.array(z.string().trim().max(200)).max(50).default([]),
  paymentMethod: z.string().trim().min(2).max(100),
  saleDate: z.iso.date(),
  handoverDate: z.iso.date().nullable().optional(),
  internalNotes: z.string().trim().max(5000).nullable().optional(),
  completionChecklist: z.record(z.string(), z.boolean()).default({}),
  confirm: z.literal(true),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "leads:manage") || !hasPermission(staff.role, "commercial:view")) {
    return NextResponse.json({ message: "Manager-level sales access is required." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review and confirm the sale details.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.deposit > input.salePrice) {
    return NextResponse.json({ message: "The deposit cannot exceed the sale price." }, { status: 400 });
  }

  const completionChecklist = Object.entries(input.completionChecklist).map(
    ([item, completed]) => ({ item, completed }),
  );
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("record_vehicle_sale", {
    p_organisation_id: staff.organisationId,
    p_vehicle_id: input.vehicleId,
    p_customer_id: input.customerId,
    p_salesperson_id: input.salespersonId ?? staff.userId,
    p_sale_price: input.salePrice,
    p_deposit: input.deposit,
    p_part_exchange_allowance: input.partExchangeAllowance,
    p_discount: input.discount,
    p_warranty: input.warranty ?? null,
    p_payment_method: input.paymentMethod,
    p_sale_date: input.saleDate,
    p_handover_date: input.handoverDate ?? null,
    p_internal_notes: input.internalNotes ?? null,
    p_additional_products: input.additionalProducts,
    p_completion_checklist: completionChecklist,
    p_actor_user_id: staff.userId,
  });
  if (error) {
    const conflict = error.code === "23505" || error.message.toLowerCase().includes("sold");
    return NextResponse.json(
      {
        message: conflict
          ? "This vehicle has already been recorded as sold."
          : "The sale was not recorded. No partial status change was accepted.",
      },
      { status: conflict ? 409 : 500 },
    );
  }
  return NextResponse.json(
    { ok: true, message: "Sale recorded and vehicle moved to sold.", sale: data },
    { status: 201 },
  );
}
