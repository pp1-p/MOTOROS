import {
  ArrowDownToLine,
  BarChart3,
  CarFront,
  CircleDollarSign,
  Clock3,
  HeartHandshake,
  Search,
  Wrench,
} from "lucide-react";

import { EmptyState, Notice, PageHeader } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { getAdminReportsSnapshot } from "@/lib/data/admin-reports";
import { formatCurrency } from "@/lib/utils";

const reports = [
  [CarFront, "Stock by status", "Live position, retail value and cost by lifecycle state", "stock-status"],
  [Clock3, "Stock age", "Days in stock, age bands and ageing vehicles", "stock-age"],
  [CircleDollarSign, "Gross profit by vehicle", "Realised sale margin and preparation cost", "gross-profit"],
  [HeartHandshake, "Lead conversion", "Source, response time, stage conversion and outcomes", "lead-conversion"],
  [Search, "Sourcing performance", "Open briefs, time to option and success rate", "sourcing"],
  [Wrench, "Repair performance", "Bookings, approval, value and turnaround", "repairs"],
] as const;

export default async function ReportsPage() {
  const snapshot = await getAdminReportsSnapshot();
  const available = snapshot.state !== "unavailable";
  const maxGrossProfit = Math.max(
    1,
    ...snapshot.monthlySales.map((month) => month.grossProfit),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business intelligence"
        title="Reports"
        description="Operational reporting built from records you have permission to view. Exports are audit logged."
        actions={
          snapshot.state === "live" ? (
            <Button asChild variant="outline" size="sm">
              <a href="/api/admin/reports/export?report=monthly-summary" download>
                <ArrowDownToLine />
                Export monthly summary
              </a>
            </Button>
          ) : undefined
        }
      />

      {snapshot.message ? (
        <Notice
          title={snapshot.state === "demo" ? "Development demo" : "Reports unavailable"}
          tone="info"
        >
          {snapshot.message}
        </Notice>
      ) : null}

      {available ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Sales &amp; gross profit</h2>
              <p className="mt-1 text-xs text-foreground/42">Current year and last six months</p>
            </div>
            <div className="p-5">
              <div className="flex gap-8">
                <div>
                  <p className="text-[10px] font-bold text-foreground/40">Sales YTD</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">
                    {snapshot.salesYtd}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-foreground/40">Gross profit YTD</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">
                    {formatCurrency(snapshot.grossProfitYtd)}
                  </p>
                </div>
              </div>
              {snapshot.monthlySales.length ? (
                <div className="mt-8 flex h-52 items-end gap-4 border-b px-2">
                  {snapshot.monthlySales.map((month) => (
                    <div key={month.key} className="group flex h-full flex-1 flex-col justify-end">
                      <div className="mb-2 hidden text-center text-[9px] font-extrabold text-brand sm:block">
                        {formatCurrency(month.grossProfit)}
                      </div>
                      <div
                        className="mx-auto w-full max-w-14 rounded-t-md bg-brand/80 transition group-hover:bg-brand"
                        style={{
                          height: `${Math.max(4, (month.grossProfit / maxGrossProfit) * 100)}%`,
                        }}
                        title={`${month.sales} sales, ${formatCurrency(month.grossProfit)} gross profit`}
                      />
                      <p className="py-2 text-center text-[9px] font-bold text-foreground/42">
                        {month.label}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-8 rounded-xl bg-surface-muted p-6 text-center text-xs text-foreground/45">
                  No completed sales have been recorded for this period.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Lead sources</h2>
              <p className="mt-1 text-xs text-foreground/42">
                Last 90 days · {snapshot.leadsLast90Days} leads
              </p>
            </div>
            <div className="space-y-4 p-5">
              {snapshot.leadSources.length ? (
                snapshot.leadSources.map((source) => (
                  <div key={source.source}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground/60">{source.source}</span>
                      <strong>
                        {source.count} · {source.percentage}%
                      </strong>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${source.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-surface-muted p-6 text-center text-xs text-foreground/45">
                  No leads have been recorded in the last 90 days.
                </p>
              )}
            </div>
          </section>
        </div>
      ) : (
        <EmptyState
          title="Live reports are not available"
          description="Configure and verify the database connection before relying on operational reports or exports."
          actionHref="/admin/health"
          actionLabel="Check System health"
        />
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="size-4 text-brand" />
          <h2 className="font-extrabold">Report library</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map(([Icon, title, description, id]) => {
            const content = (
              <>
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft">
                  <Icon className="size-4 text-brand" />
                </span>
                <h3 className="mt-4 text-sm font-extrabold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-foreground/45">{description}</p>
                <span className="mt-4 block text-[10px] font-extrabold text-brand">
                  {snapshot.state === "live" ? "Download CSV →" : "Live connection required"}
                </span>
              </>
            );
            return snapshot.state === "live" ? (
              <a
                key={id}
                href={`/api/admin/reports/export?report=${id}`}
                download
                className="group rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg"
              >
                {content}
              </a>
            ) : (
              <div key={id} className="rounded-2xl border bg-white p-5 opacity-70">
                {content}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
