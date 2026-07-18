import Link from "next/link";
import { ArrowRight, CalendarDays, CircleDollarSign, Plus, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { getAdminSalesPipeline } from "@/lib/data/admin-operational";
import { getStaffContext, hasPermission } from "@/lib/auth/permissions";

const stages = [
  { label: "Qualified", tone: "bg-blue-500" },
  { label: "Viewing / test drive", tone: "bg-violet-500" },
  { label: "Negotiation", tone: "bg-amber-500" },
  { label: "Deposit taken", tone: "bg-teal-500" },
  { label: "Won / handover", tone: "bg-emerald-500" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function SalesPipelinePage() {
  const [{ opportunities, metrics }, staff] = await Promise.all([
    getAdminSalesPipeline(),
    getStaffContext(),
  ]);
  const canRecordSale = staff
    ? hasPermission(staff.role, "commercial:view")
    : false;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales workflow"
        title="Sales pipeline"
        description="Track each qualified opportunity from first appointment through deposit, sale and handover."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/leads?create=1">
                <Plus />
                Add opportunity
              </Link>
            </Button>
            {canRecordSale ? (
              <Button asChild size="sm">
                <Link href="/admin/sales/new">
                  <Plus />
                  Record sale
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            CircleDollarSign,
            formatCurrency(metrics.openPipelineValue),
            "Open pipeline value",
          ],
          [
            TrendingUp,
            `${metrics.conversionRate}%`,
            "Lead-to-sale conversion",
          ],
          [
            CalendarDays,
            String(metrics.handoversThisWeek),
            "Handovers this week",
          ],
        ].map(([Icon, value, label]) => {
          const Component = Icon as typeof CircleDollarSign;
          return (
            <div key={String(label)} className="flex items-center gap-3 rounded-xl border bg-white p-4">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft">
                <Component className="size-4 text-brand" />
              </span>
              <div>
                <p className="font-extrabold">{String(value)}</p>
                <p className="text-[11px] text-foreground/45">{String(label)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1200px] grid-cols-5 gap-3">
          {stages.map((stage) => {
            const cards = opportunities.filter(
              (opportunity) => opportunity.stage === stage.label,
            );
            return (
              <section key={stage.label} className="rounded-2xl bg-[#e9ebe7] p-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className={`size-2 rounded-full ${stage.tone}`} />
                  <h2 className="text-xs font-extrabold">{stage.label}</h2>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {cards.map((opportunity) => (
                    <Link
                      key={opportunity.id}
                      href={opportunity.href}
                      className="block rounded-xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <p className="text-xs font-extrabold">
                        {opportunity.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-foreground/45">
                        {opportunity.subject}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t pt-2">
                        <span className="text-[9px] font-semibold text-foreground/38">
                          {opportunity.owner}
                        </span>
                        <strong className="text-[10px]">
                          {opportunity.value}
                        </strong>
                      </div>
                    </Link>
                  ))}
                  {!cards.length ? (
                    <Link
                      href="/admin/leads"
                      className="flex min-h-24 items-center justify-center rounded-xl border border-dashed bg-white/35 text-[10px] font-bold text-foreground/35 hover:bg-white/70"
                    >
                      Move an opportunity here
                      <ArrowRight className="ml-1 size-3" />
                    </Link>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
