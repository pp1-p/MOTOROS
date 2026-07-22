import "server-only";

import { getStaffContext } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type {
  InvoiceDetail,
  InvoiceLineItem,
  InvoicePayment,
  InvoiceStatus,
  InvoiceSummary,
  InvoiceType,
} from "@/lib/types/invoices";

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapSummary(row: Record<string, unknown>): InvoiceSummary {
  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number),
    type: String(row.type) as InvoiceType,
    status: String(row.status) as InvoiceStatus,
    customerName: String(row.customer_name_snapshot ?? "Customer"),
    vehicleDescription: (row.vehicle_description_snapshot as string | null) ?? null,
    vehicleRegistration: (row.vehicle_registration_snapshot as string | null) ?? null,
    total: numeric(row.total),
    amountPaid: numeric(row.amount_paid),
    balance: numeric(row.balance),
    currency: String(row.currency ?? "GBP"),
    issuedAt: (row.issued_at as string | null) ?? null,
    dueAt: (row.due_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export type InvoiceListFilters = {
  status?: InvoiceStatus | "all";
  type?: InvoiceType | "all";
  search?: string;
};

export async function getInvoiceList(
  filters: InvoiceListFilters = {},
): Promise<{ invoices: InvoiceSummary[]; totals: Record<InvoiceStatus, number> }> {
  if (!isSupabaseConfigured()) {
    return { invoices: [], totals: emptyTotals() };
  }
  const staff = await getStaffContext();
  if (!staff) return { invoices: [], totals: emptyTotals() };

  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("invoices")
    .select(
      "id,invoice_number,type,status,customer_name_snapshot,vehicle_description_snapshot,vehicle_registration_snapshot,total,amount_paid,balance,currency,issued_at,due_at,created_at",
    )
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.type && filters.type !== "all") {
    query = query.eq("type", filters.type);
  }
  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search.replace(/[%_]/g, "")}%`;
    query = query.or(
      `invoice_number.ilike.${pattern},customer_name_snapshot.ilike.${pattern},vehicle_registration_snapshot.ilike.${pattern}`,
    );
  }

  const result = await query;
  if (result.error) {
    throw new Error(`Invoices could not be loaded: ${result.error.message}`);
  }

  const invoices = (result.data ?? []).map(mapSummary);
  const totals = emptyTotals();
  for (const invoice of invoices) {
    totals[invoice.status] = (totals[invoice.status] ?? 0) + 1;
  }
  return { invoices, totals };
}

function emptyTotals(): Record<InvoiceStatus, number> {
  return {
    draft: 0,
    sent: 0,
    viewed: 0,
    partially_paid: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
    refunded: 0,
    credited: 0,
    void: 0,
  };
}

export async function getInvoiceById(id: string): Promise<InvoiceDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const staff = await getStaffContext();
  if (!staff) return null;

  const supabase = createAdminSupabaseClient();
  const [invoiceResult, itemsResult, paymentsResult, activityResult] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("invoice_line_items")
        .select(
          "id,sort_order,item_type,description,quantity,unit_price,vat_rate,discount_amount,vat_treatment,source_type,source_id,line_net,line_vat,line_total",
        )
        .eq("invoice_id", id)
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
      supabase
        .from("invoice_payments")
        .select(
          "id,amount,method,paid_at,reference,notes,is_refund,recorded_by",
        )
        .eq("invoice_id", id)
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .order("paid_at", { ascending: true }),
      supabase
        .from("invoice_activity")
        .select("id,action,detail,occurred_at,actor_user_id")
        .eq("invoice_id", id)
        .eq("organisation_id", staff.organisationId)
        .order("occurred_at", { ascending: false })
        .limit(50),
    ]);

  if (invoiceResult.error) {
    throw new Error(`Invoice could not be loaded: ${invoiceResult.error.message}`);
  }
  const row = invoiceResult.data;
  if (!row) return null;

  const actorIds = [
    ...new Set(
      (activityResult.data ?? [])
        .map((entry) => entry.actor_user_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  const profiles = actorIds.length
    ? await supabase.from("profiles").select("id,display_name,full_name").in("id", actorIds)
    : { data: [], error: null };
  const actorNames = new Map(
    (profiles.data ?? []).map((profile) => [
      profile.id,
      profile.display_name ?? profile.full_name ?? "Team member",
    ]),
  );

  const summary = mapSummary(row as Record<string, unknown>);
  const lineItems: InvoiceLineItem[] = (itemsResult.data ?? []).map((item) => ({
    id: String(item.id),
    sortOrder: Number(item.sort_order),
    itemType: item.item_type as InvoiceLineItem["itemType"],
    description: String(item.description),
    quantity: numeric(item.quantity),
    unitPrice: numeric(item.unit_price),
    vatRate: numeric(item.vat_rate),
    discountAmount: numeric(item.discount_amount),
    vatTreatment: item.vat_treatment as InvoiceLineItem["vatTreatment"],
    sourceType: (item.source_type as string | null) ?? null,
    sourceId: (item.source_id as string | null) ?? null,
    lineNet: numeric(item.line_net),
    lineVat: numeric(item.line_vat),
    lineTotal: numeric(item.line_total),
  }));
  const payments: InvoicePayment[] = (paymentsResult.data ?? []).map((payment) => ({
    id: String(payment.id),
    amount: numeric(payment.amount),
    method: payment.method as InvoicePayment["method"],
    paidAt: String(payment.paid_at),
    reference: (payment.reference as string | null) ?? null,
    notes: (payment.notes as string | null) ?? null,
    isRefund: Boolean(payment.is_refund),
    recordedBy: (payment.recorded_by as string | null) ?? null,
  }));

  return {
    ...summary,
    customerId: (row.customer_id as string | null) ?? null,
    customerEmail: (row.customer_email_snapshot as string | null) ?? null,
    customerPhone: (row.customer_phone_snapshot as string | null) ?? null,
    billingAddress: (row.billing_address_snapshot as Record<string, unknown>) ?? {},
    vehicleId: (row.vehicle_id as string | null) ?? null,
    saleId: (row.sale_id as string | null) ?? null,
    repairJobId: (row.repair_job_id as string | null) ?? null,
    sourcingRequestId: (row.sourcing_request_id as string | null) ?? null,
    subtotalNet: numeric(row.subtotal_net),
    discountTotal: numeric(row.discount_total),
    vatTotal: numeric(row.vat_total),
    vatTreatment: row.vat_treatment as InvoiceDetail["vatTreatment"],
    vatRegistration: (row.vat_registration_snapshot as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    terms: (row.terms as string | null) ?? null,
    lineItems,
    payments,
    activity: (activityResult.data ?? []).map((entry) => ({
      id: String(entry.id),
      action: String(entry.action),
      detail: (entry.detail as string | null) ?? null,
      occurredAt: String(entry.occurred_at),
      actorName: entry.actor_user_id
        ? actorNames.get(entry.actor_user_id) ?? "Team member"
        : "System",
    })),
  };
}

export async function getInvoicesForRepair(
  repairJobId: string,
): Promise<InvoiceSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const staff = await getStaffContext();
  if (!staff) return [];

  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("invoices")
    .select(
      "id,invoice_number,type,status,customer_name_snapshot,vehicle_description_snapshot,vehicle_registration_snapshot,total,amount_paid,balance,currency,issued_at,due_at,created_at",
    )
    .eq("repair_job_id", repairJobId)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (result.error) return [];
  return (result.data ?? []).map((row) =>
    mapSummary(row as Record<string, unknown>),
  );
}

export async function getInvoiceForSale(
  saleId: string,
): Promise<InvoiceSummary | null> {
  if (!isSupabaseConfigured()) return null;
  const staff = await getStaffContext();
  if (!staff) return null;

  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("invoices")
    .select(
      "id,invoice_number,type,status,customer_name_snapshot,vehicle_description_snapshot,vehicle_registration_snapshot,total,amount_paid,balance,currency,issued_at,due_at,created_at",
    )
    .eq("sale_id", saleId)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .not("status", "in", '("cancelled","void")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error || !result.data) return null;
  return mapSummary(result.data as Record<string, unknown>);
}
