import Link from "next/link";
import { FileText, Filter, Search } from "lucide-react";

import { PageHeader } from "@/components/admin/page-kit";
import { getInvoiceList } from "@/lib/data/admin-invoices";
import {
  formatDate,
  formatMoney,
  invoiceStatusLabel,
  invoiceStatusTone,
  invoiceTypeLabel,
} from "@/lib/invoices/format";
import type { InvoiceStatus, InvoiceType } from "@/lib/types/invoices";

const statusFilters: (InvoiceStatus | "all")[] = [
  "all",
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
];

const typeFilters: (InvoiceType | "all")[] = [
  "all",
  "vehicle_sale",
  "repair",
  "sourcing",
  "credit_note",
  "pro_forma",
];

type PageProps = {
  searchParams: Promise<{
    status?: string;
    type?: string;
    q?: string;
  }>;
};

export default async function InvoicesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = (statusFilters.includes(params.status as InvoiceStatus)
    ? (params.status as InvoiceStatus)
    : "all") as InvoiceStatus | "all";
  const type = (typeFilters.includes(params.type as InvoiceType)
    ? (params.type as InvoiceType)
    : "all") as InvoiceType | "all";
  const q = params.q?.trim() ?? "";

  const { invoices, totals } = await getInvoiceList({
    status,
    type,
    search: q,
  });

  const kpi = [
    { label: "All", value: invoices.length, status: "all" as const },
    { label: "Outstanding", value: totals.sent + totals.partially_paid, status: "sent" as InvoiceStatus | "all" },
    { label: "Overdue", value: totals.overdue, status: "overdue" as const },
    { label: "Paid", value: totals.paid, status: "paid" as const },
    { label: "Drafts", value: totals.draft, status: "draft" as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Invoices"
        description="Invoices linked to sales, repairs and sourcing jobs across your dealership."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpi.map((tile) => (
          <Link
            key={tile.label}
            href={buildFilterHref({ status: tile.status, type, q })}
            className="rounded-xl border bg-white p-3.5 transition hover:border-foreground/20"
          >
            <p className="text-lg font-extrabold tracking-[-0.032em] tabular-nums">
              {tile.value}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-foreground/45">
              {tile.label}
            </p>
          </Link>
        ))}
      </div>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"
      >
        <div className="min-w-56 flex-1">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">
            Search
          </label>
          <div className="relative mt-1.5">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Invoice number, customer, registration…"
              className="h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">
            Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="mt-1.5 h-11 rounded-xl border bg-white px-3 text-sm"
          >
            {statusFilters.map((option) => (
              <option key={option} value={option}>
                {option === "all"
                  ? "All statuses"
                  : invoiceStatusLabel(option as InvoiceStatus)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">
            Type
          </label>
          <select
            name="type"
            defaultValue={type}
            className="mt-1.5 h-11 rounded-xl border bg-white px-3 text-sm"
          >
            {typeFilters.map((option) => (
              <option key={option} value={option}>
                {option === "all"
                  ? "All types"
                  : invoiceTypeLabel(option as InvoiceType)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-xs font-extrabold text-white hover:bg-brand-strong"
        >
          <Filter className="size-4" />
          Apply
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border bg-white">
        {invoices.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="border-b bg-[#fafaf8] text-[10px] font-extrabold uppercase tracking-wider text-foreground/38">
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y font-semibold">
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="cursor-pointer transition-colors hover:bg-[#fafaf8]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/invoices/${invoice.id}`}
                        className="font-extrabold text-brand hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      {invoiceTypeLabel(invoice.type)}
                    </td>
                    <td className="px-4 py-3">{invoice.customerName}</td>
                    <td className="px-4 py-3 text-foreground/70">
                      {invoice.vehicleRegistration ?? invoice.vehicleDescription ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${invoiceStatusTone(invoice.status)}`}
                      >
                        {invoiceStatusLabel(invoice.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/60">
                      {formatDate(invoice.issuedAt ?? invoice.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold tabular-nums">
                      {formatMoney(invoice.total, invoice.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold tabular-nums text-amber-800">
                      {formatMoney(invoice.balance, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <FileText className="size-10 text-foreground/25" />
            <p className="text-sm font-extrabold">No invoices yet</p>
            <p className="max-w-md text-xs text-foreground/50">
              Complete a vehicle sale and open its detail page to create the
              first invoice. Repairs and sourcing invoices arrive in phase 2.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function buildFilterHref(input: {
  status: InvoiceStatus | "all";
  type: InvoiceType | "all";
  q: string;
}) {
  const params = new URLSearchParams();
  if (input.status !== "all") params.set("status", input.status);
  if (input.type !== "all") params.set("type", input.type);
  if (input.q) params.set("q", input.q);
  const query = params.toString();
  return query ? `/admin/invoices?${query}` : "/admin/invoices";
}
