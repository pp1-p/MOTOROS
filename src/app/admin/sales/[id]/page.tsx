import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CarFront, FileText, UserRound } from "lucide-react";

import { CreateSaleInvoiceButton } from "@/components/admin/create-sale-invoice-button";
import { PageHeader, StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { hasPermission, requireStaff } from "@/lib/auth/permissions";
import { getSaleDetailSelect } from "@/lib/auth/sales-access";
import { getInvoiceForSale } from "@/lib/data/admin-invoices";
import {
  formatMoney,
  invoiceStatusLabel,
  invoiceStatusTone,
} from "@/lib/invoices/format";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";

type SaleDetailRow = {
  reference: string;
  salesperson_id: string | null;
  status: string;
  sale_price: number | null;
  deposit: number | null;
  part_exchange_allowance: number | null;
  discount: number | null;
  payment_method: string | null;
  sale_date: string | null;
  handover_date: string | null;
  created_at: string;
  gross_profit?: number | null;
  internal_notes?: string | null;
  vehicles:
    | {
        id: string;
        stock_number: string;
        registration: string | null;
        make: string;
        model: string;
        derivative: string | null;
      }
    | Array<{
        id: string;
        stock_number: string;
        registration: string | null;
        make: string;
        model: string;
        derivative: string | null;
      }>
    | null;
  customers:
    | {
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
      }
    | Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
      }>
    | null;
};

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff("leads:view");
  const canViewCommercial = hasPermission(staff.role, "commercial:view");
  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  let saleQuery = supabase
    .from("sales")
    .select(getSaleDetailSelect(canViewCommercial))
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null);
  if (staff.role === "salesperson") {
    saleQuery = saleQuery.eq("salesperson_id", staff.userId);
  }
  const sale = await saleQuery.single();
  if (sale.error || !sale.data) notFound();
  const saleData = sale.data as unknown as SaleDetailRow;
  const invoice = await getInvoiceForSale(id);
  const canManageInvoices = hasPermission(staff.role, "invoices:manage");
  const vehicle = Array.isArray(saleData.vehicles)
    ? saleData.vehicles[0]
    : saleData.vehicles;
  const customer = Array.isArray(saleData.customers)
    ? saleData.customers[0]
    : saleData.customers;
  const grossProfit =
    canViewCommercial
      ? Number(saleData.gross_profit ?? 0)
      : null;
  const internalNotes =
    canViewCommercial &&
    typeof saleData.internal_notes === "string"
      ? saleData.internal_notes
      : null;
  const salesperson = saleData.salesperson_id
    ? await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", saleData.salesperson_id)
        .maybeSingle()
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow={saleData.reference}
        title={`${vehicle?.make ?? "Vehicle"} ${vehicle?.model ?? "sale"}`}
        description={`Recorded ${new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(saleData.sale_date ?? saleData.created_at))}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/sales">
              <ArrowLeft />
              Sales pipeline
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Status", <StatusPill key="status" status={saleData.status} />],
          ["Sale price", formatCurrency(Number(saleData.sale_price ?? 0))],
          ...(canViewCommercial
            ? [["Gross profit", formatCurrency(grossProfit ?? 0)]]
            : []),
          [
            "Handover",
            saleData.handover_date
              ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                  new Date(saleData.handover_date),
                )
              : "Not scheduled",
          ],
        ].map(([label, value]) => (
          <section key={String(label)} className="rounded-xl border bg-white p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/38">
              {label}
            </p>
            <div className="mt-2 text-sm font-extrabold">{value}</div>
          </section>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="flex items-center gap-2 font-extrabold">
            <CarFront className="size-4 text-brand" />
            Vehicle
          </h2>
          <p className="mt-4 text-sm font-extrabold">
            {vehicle?.make} {vehicle?.model} {vehicle?.derivative}
          </p>
          <p className="mt-1 text-xs text-foreground/45">
            {vehicle?.registration} · {vehicle?.stock_number}
          </p>
          {vehicle?.id ? (
            <Link
              href={`/admin/stock/${vehicle.id}`}
              className="mt-4 inline-block text-xs font-extrabold text-brand hover:underline"
            >
              Open stock record
            </Link>
          ) : null}
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="flex items-center gap-2 font-extrabold">
            <UserRound className="size-4 text-brand" />
            Customer & salesperson
          </h2>
          <p className="mt-4 text-sm font-extrabold">{customer?.full_name}</p>
          <p className="mt-1 text-xs text-foreground/45">
            {customer?.email ?? customer?.phone ?? "No contact detail"}
          </p>
          <p className="mt-4 text-xs">
            Salesperson:{" "}
            <strong>
              {salesperson?.data?.display_name ??
                "Unassigned"}
            </strong>
          </p>
        </section>
      </div>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-extrabold">Commercial summary</h2>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-foreground/45">Deposit</dt>
            <dd className="mt-1 font-extrabold">{formatCurrency(Number(saleData.deposit ?? 0))}</dd>
          </div>
          <div>
            <dt className="text-foreground/45">Part exchange</dt>
            <dd className="mt-1 font-extrabold">{formatCurrency(Number(saleData.part_exchange_allowance ?? 0))}</dd>
          </div>
          <div>
            <dt className="text-foreground/45">Discount</dt>
            <dd className="mt-1 font-extrabold">{formatCurrency(Number(saleData.discount ?? 0))}</dd>
          </div>
          <div>
            <dt className="text-foreground/45">Payment</dt>
            <dd className="mt-1 font-extrabold">{saleData.payment_method ?? "Not recorded"}</dd>
          </div>
        </dl>
        {internalNotes ? (
          <p className="mt-5 rounded-xl bg-surface-muted p-4 text-xs leading-5">
            {internalNotes}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-extrabold">
              <FileText className="size-4 text-brand" />
              Invoice
            </h2>
            <p className="mt-1 text-xs text-foreground/45">
              An invoice pulls this sale&apos;s customer, vehicle and payments
              into one document your customer can pay against.
            </p>
          </div>
          {!invoice && canManageInvoices ? (
            <CreateSaleInvoiceButton saleId={id} />
          ) : null}
        </div>
        {invoice ? (
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border bg-[#fafaf8] p-4">
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/invoices/${invoice.id}`}
                className="text-sm font-extrabold text-brand hover:underline"
              >
                {invoice.invoiceNumber}
              </Link>
              <p className="mt-0.5 text-[11px] text-foreground/55">
                {formatMoney(invoice.total, invoice.currency)} total ·{" "}
                {formatMoney(invoice.amountPaid, invoice.currency)} paid ·{" "}
                <span className="font-extrabold text-amber-800">
                  {formatMoney(invoice.balance, invoice.currency)} outstanding
                </span>
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold ${invoiceStatusTone(invoice.status)}`}
            >
              {invoiceStatusLabel(invoice.status)}
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/invoices/${invoice.id}`}>Open invoice</Link>
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-xs text-foreground/55">
            {canManageInvoices
              ? "No invoice yet — create one to record the sale price, warranty and any extras, and to accept payment."
              : "No invoice yet. Your role cannot create invoices."}
          </p>
        )}
      </section>
    </div>
  );
}
