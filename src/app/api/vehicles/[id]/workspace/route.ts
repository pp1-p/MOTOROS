import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const idSchema = z.uuid();
const nullableShortText = z
  .string()
  .trim()
  .max(240)
  .optional()
  .nullable()
  .transform((value) => value || null);

const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_cost"),
    costType: z.enum([
      "purchase",
      "preparation",
      "repair",
      "transport",
      "advertising",
      "warranty",
      "other",
    ]),
    supplierName: nullableShortText,
    description: z.string().trim().min(2).max(500),
    amountNet: z.coerce.number().min(0).max(20_000_000),
    vatAmount: z.coerce.number().min(0).max(20_000_000).default(0),
    incurredOn: z.iso.date(),
  }),
  z.object({
    action: z.literal("add_service_record"),
    serviceDate: z.iso.date(),
    mileage: z.coerce.number().int().min(0).max(2_000_000).optional().nullable(),
    dealershipName: nullableShortText,
    workCompleted: z.string().trim().min(2).max(2000),
  }),
  z.object({
    action: z.literal("add_note"),
    note: z.string().trim().min(1).max(5000),
    isPinned: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("add_video"),
    title: z.string().trim().min(1).max(160),
    videoUrl: z.url().refine((value) => value.startsWith("https://"), {
      message: "Video links must use HTTPS.",
    }),
    isPublic: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("save_channel"),
    channel: z.enum(["website", "autotrader", "ebay", "carwow", "other"]),
    status: z.enum([
      "not_configured",
      "draft",
      "ready",
      "pending",
      "published",
      "paused",
      "failed",
      "removed",
      "over_contracted",
    ]),
    externalStockId: nullableShortText,
    externalDerivativeId: nullableShortText,
    listingTitle: nullableShortText,
    listingSubtitle: nullableShortText,
    category: nullableShortText,
    listingUrl: z.url().optional().nullable().or(z.literal("")),
  }),
  z.object({
    action: z.literal("link_invoice"),
    invoiceId: z.uuid(),
  }),
]);

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
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (
    !hasPermission(staff.role, "stock:manage") &&
    !hasPermission(staff.role, "website:manage")
  ) {
    return NextResponse.json(
      { message: "You do not have permission to update vehicle records." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: "Invalid vehicle ID." }, { status: 400 });
  }
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the vehicle record details.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (
    parsed.data.action === "add_cost" &&
    !hasPermission(staff.role, "commercial:view")
  ) {
    return NextResponse.json(
      { message: "Commercial fields require manager access." },
      { status: 403 },
    );
  }
  if (
    parsed.data.action === "link_invoice" &&
    !hasPermission(staff.role, "invoices:manage")
  ) {
    return NextResponse.json(
      { message: "Invoice management permission is required." },
      { status: 403 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const vehicle = await supabase
    .from("vehicles")
    .select("id,registration,year,make,model,derivative")
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .single();
  if (!vehicle.data) {
    return NextResponse.json({ message: "Vehicle not found." }, { status: 404 });
  }

  let mutation: { data: unknown; error: { message: string } | null };
  let auditAction = "";
  let auditReason = "";

  switch (parsed.data.action) {
    case "add_cost":
      mutation = await supabase
        .from("vehicle_costs")
        .insert({
          organisation_id: staff.organisationId,
          vehicle_id: id,
          cost_type: parsed.data.costType,
          supplier_name: parsed.data.supplierName,
          description: parsed.data.description,
          amount_net: parsed.data.amountNet,
          vat_amount: parsed.data.vatAmount,
          incurred_on: parsed.data.incurredOn,
          created_by: staff.userId,
        })
        .select("id")
        .single();
      auditAction = "vehicle.cost_added";
      auditReason = `${parsed.data.description} cost added`;
      break;
    case "add_service_record":
      mutation = await supabase
        .from("vehicle_service_records")
        .insert({
          organisation_id: staff.organisationId,
          vehicle_id: id,
          service_date: parsed.data.serviceDate,
          mileage: parsed.data.mileage,
          dealership_name: parsed.data.dealershipName,
          work_completed: parsed.data.workCompleted,
          created_by: staff.userId,
        })
        .select("id")
        .single();
      auditAction = "vehicle.service_record_added";
      auditReason = `Service record added for ${parsed.data.serviceDate}`;
      break;
    case "add_note":
      mutation = await supabase
        .from("vehicle_notes")
        .insert({
          organisation_id: staff.organisationId,
          vehicle_id: id,
          note: parsed.data.note,
          is_pinned: parsed.data.isPinned,
          created_by: staff.userId,
        })
        .select("id")
        .single();
      auditAction = "vehicle.note_added";
      auditReason = parsed.data.isPinned ? "Pinned vehicle note added" : "Vehicle note added";
      break;
    case "add_video":
      mutation = await supabase
        .from("vehicle_videos")
        .insert({
          organisation_id: staff.organisationId,
          vehicle_id: id,
          title: parsed.data.title,
          video_url: parsed.data.videoUrl,
          is_public: parsed.data.isPublic,
          created_by: staff.userId,
        })
        .select("id")
        .single();
      auditAction = "vehicle.video_added";
      auditReason = `${parsed.data.title} video added`;
      break;
    case "save_channel":
      mutation = await supabase
        .from("vehicle_sales_channels")
        .upsert(
          {
            organisation_id: staff.organisationId,
            vehicle_id: id,
            channel: parsed.data.channel,
            status: parsed.data.status,
            external_stock_id: parsed.data.externalStockId,
            external_derivative_id: parsed.data.externalDerivativeId,
            listing_title: parsed.data.listingTitle,
            listing_subtitle: parsed.data.listingSubtitle,
            category: parsed.data.category,
            listing_url: parsed.data.listingUrl || null,
            created_by: staff.userId,
          },
          { onConflict: "vehicle_id,channel" },
        )
        .select("id")
        .single();
      auditAction = "vehicle.sales_channel_updated";
      auditReason = `${parsed.data.channel} channel set to ${parsed.data.status}`;
      break;
    case "link_invoice": {
      const invoice = await supabase
        .from("invoices")
        .select("id,invoice_number,vehicle_id,type")
        .eq("id", parsed.data.invoiceId)
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .maybeSingle();
      if (invoice.error || !invoice.data) {
        return NextResponse.json({ message: "Invoice not found." }, { status: 404 });
      }
      if (!["general", "pro_forma", "vat"].includes(invoice.data.type)) {
        return NextResponse.json(
          { message: "Sale and repair invoices must remain linked through their source record." },
          { status: 422 },
        );
      }
      if (invoice.data.vehicle_id && invoice.data.vehicle_id !== id) {
        return NextResponse.json(
          { message: "That invoice is already linked to another vehicle." },
          { status: 409 },
        );
      }
      mutation = await supabase
        .from("invoices")
        .update({
          vehicle_id: id,
          vehicle_registration_snapshot: vehicle.data.registration,
          vehicle_description_snapshot: [
            vehicle.data.year,
            vehicle.data.make,
            vehicle.data.model,
            vehicle.data.derivative,
          ]
            .filter(Boolean)
            .join(" "),
        })
        .eq("id", parsed.data.invoiceId)
        .eq("organisation_id", staff.organisationId)
        .select("id")
        .single();
      auditAction = "vehicle.invoice_linked";
      auditReason = `Invoice ${invoice.data.invoice_number} linked to vehicle`;
      break;
    }
  }

  if (mutation.error) {
    return NextResponse.json(
      { message: `The record could not be saved: ${mutation.error.message}` },
      { status: 500 },
    );
  }

  if (parsed.data.action === "link_invoice") {
    await supabase.from("invoice_activity").insert({
      organisation_id: staff.organisationId,
      invoice_id: parsed.data.invoiceId,
      actor_user_id: staff.userId,
      action: "invoice.vehicle_linked",
      detail: `Linked to ${vehicle.data.registration ?? "stock vehicle"}`,
    });
  }

  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: auditAction,
    entity_type: "vehicle",
    entity_id: id,
    change_reason: auditReason,
    new_values: parsed.data,
  });

  return NextResponse.json({ ok: true, message: "Vehicle record saved." });
}
