import Link from "next/link";
import { ArrowDownToLine, FileText } from "lucide-react";

import { EmptyState, Notice, PageHeader } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/permissions";
import { getInvoiceReportsSnapshot } from "@/lib/data/admin-invoice-reports";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invoice reports",
};

const typeLabels = {
  vehicle_sale: "Vehicle sale",
  repair: "Repair",
  other: "Other",
} as const;

export default async function InvoiceReportsPage() {
  await requireStaff("invoices:view");
  const snapshot = await getInvoiceReportsSnapshot();
  const monthlyMax = Math.max(
    1,
    ...snapshot.monthly.map(
      (row) => row.vehicleSaleTotal + row.repairTotal + row.otherTotal,
    ),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business intelligence"
        title="Invoice reports"
        description="Totals by invoice type, VAT summary and aged debt across your dealership."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/api/admin/invoices/export" download>
                <ArrowDownToLine />
                Export CSV
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/invoices">
                <FileText />
                All invoices
              </Link>
            </Button>
          </div>
        }
      />

      {snapshot.state === "unavailable" ? (
        <>
          <Notice title="Live data unavailable" tone="info">
            Invoice reports need a working database connection. Reconnect
            Supabase and reload the page.
          </Notice>
          <EmptyState
            title="No invoice data to summarise"
            description="Once your first invoice is raised this page fills in."
            actionHref="/admin/invoices"
            actionLabel="Open invoices"
          />
        </>
      ) : null}

      {snapshot.state === "ready" ? (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            {[
              {
                label: "Outstanding",
                value: snapshot.totals.outstanding,
                tone: "text-red-700",
              },
              {
                label: "Invoiced · last 30d",
                value: snapshot.totals.invoicedLast30Days,
                tone: "text-foreground",
              },
              {
                label: "Received · last 30d",
                value: snapshot.totals.paidLast30Days,
                tone: "text-emerald-700",
              },
              {
                label: "VAT collected · last 30d",
                value: snapshot.totals.vatCollectedLast30Days,
                tone: "text-foreground",
              },
            ].map((tile) => (
              <div key={tile.label} className="rounded-2xl border bg-white p-4">
                <p className="text-[10px] font-extrabold tracking-[0.14em] text-foreground/50 uppercase">
                  {tile.label}
                </p>
                <p
                  className={`mt-1 text-2xl font-extrabold tracking-[-0.02em] tabular-nums ${tile.tone}`}
                >
                  {formatCurrency(tile.value)}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Monthly totals by type</h2>
              <p className="mt-1 text-xs text-foreground/50">
                Vehicle sale, repair and general invoices — last 12 months of
                activity.
              </p>
            </div>
            {snapshot.monthly.length === 0 ? (
              <p className="p-6 text-sm text-foreground/45">
                No invoices raised yet.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b bg-surface-muted text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-foreground/55">
                  <tr>
                    <th className="px-5 py-3">Month</th>
                    <th className="px-5 py-3 text-right">
                      {typeLabels.vehicle_sale}
                    </th>
                    <th className="px-5 py-3 text-right">{typeLabels.repair}</th>
                    <th className="px-5 py-3 text-right">{typeLabels.other}</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-right">VAT</th>
                    <th className="px-5 py-3 text-right">#</th>
                    <th className="w-40 px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {snapshot.monthly.map((row) => {
                    const monthTotal =
                      row.vehicleSaleTotal + row.repairTotal + row.otherTotal;
                    const pct = Math.min(
                      100,
                      Math.round((monthTotal / monthlyMax) * 100),
                    );
                    return (
                      <tr key={row.monthKey}>
                        <td className="px-5 py-3 font-extrabold">
                          {row.monthLabel}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatCurrency(row.vehicleSaleTotal)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatCurrency(row.repairTotal)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatCurrency(row.otherTotal)}
                        </td>
                        <td className="px-5 py-3 text-right font-extrabold tabular-nums">
                          {formatCurrency(monthTotal)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-foreground/60">
                          {formatCurrency(row.vatCharged)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-foreground/45">
                          {row.invoiceCount}
                        </td>
                        <td className="px-5 py-3">
                          <div className="h-1.5 w-full rounded-full bg-surface-muted">
                            <div
                              className="h-1.5 rounded-full bg-brand"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Aged debt</h2>
              <p className="mt-1 text-xs text-foreground/50">
                Outstanding balances grouped by days since the invoice&apos;s
                due date (or issue date if no due date was set).
              </p>
            </div>
            <table className="min-w-full text-sm">
              <thead className="border-b bg-surface-muted text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-foreground/55">
                <tr>
                  <th className="px-5 py-3">Bucket</th>
                  <th className="px-5 py-3 text-right">Outstanding</th>
                  <th className="px-5 py-3 text-right">Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {snapshot.agedDebt.map((bucket) => (
                  <tr key={bucket.label}>
                    <td className="px-5 py-3 font-extrabold">{bucket.label}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatCurrency(bucket.balance)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground/60">
                      {bucket.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
