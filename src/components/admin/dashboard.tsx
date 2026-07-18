import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  HandCoins,
  HeartHandshake,
  ListTodo,
  Search,
  ShoppingBag,
  Wrench,
} from "lucide-react";

import {
  Avatar,
  DataCard,
  EmptyState,
  MetricCard,
  Notice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import type {
  AdminDiaryAppointment,
  AdminLeadListItem,
} from "@/lib/types/admin-operational";
import type { DashboardSnapshot } from "@/lib/data/dashboard";
import { formatCurrency } from "@/lib/utils";

type DashboardDetails = {
  leads: AdminLeadListItem[];
  appointments: AdminDiaryAppointment[];
  averageLeadResponseMinutes: number | null;
  salesTrend: Array<{
    key: string;
    label: string;
    sales: number;
    grossProfit: number;
  }>;
};

export function Dashboard({
  snapshot,
  details,
}: {
  snapshot: DashboardSnapshot | null;
  details: DashboardDetails | null;
}) {
  if (!snapshot) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Dealership overview"
          title="Overview unavailable"
          description="DealerOS will show live operational metrics here after the database connection is configured and verified."
        />
        <Notice title="No production data is being substituted" tone="info">
          The overview is intentionally empty because live dealership data could not be loaded.
        </Notice>
        <EmptyState
          title="Connect the operational database"
          description="Check the Supabase connection and your dealership membership before relying on this dashboard."
          actionHref="/admin/health"
          actionLabel="Check System health"
        />
      </div>
    );
  }

  const firstName = snapshot.displayName.split(" ")[0] || "there";
  const today = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: "Europe/London",
  }).format(new Date());
  const stockRows = [
    {
      label: "Ready for sale",
      value: snapshot.stockReadyForSale,
      tone: "bg-emerald-500",
    },
    {
      label: "In preparation",
      value: snapshot.stockInPreparation,
      tone: "bg-amber-500",
    },
    { label: "Reserved", value: snapshot.vehiclesReserved, tone: "bg-blue-500" },
    { label: "Due in", value: snapshot.vehiclesDueIn, tone: "bg-violet-500" },
  ];
  const stockTotal = Math.max(
    snapshot.vehiclesInStock,
    stockRows.reduce((total, row) => total + row.value, 0),
    1,
  );
  const maxTrendGross = Math.max(
    1,
    ...(details?.salesTrend.map((month) => month.grossProfit) ?? []),
  );
  const operationalItems = [
    { value: String(snapshot.vehiclesDueIn), label: "Due in", href: "/admin/stock", icon: ShoppingBag },
    { value: String(snapshot.vehiclesReserved), label: "Reserved", href: "/admin/stock", icon: HandCoins },
    ...(snapshot.canViewLeads
      ? [{ value: String(snapshot.vehiclesSoldThisMonth), label: "Sold this month", href: "/admin/sales", icon: CheckCircle2 }]
      : []),
    ...(snapshot.canViewSourcing
      ? [{ value: String(snapshot.openSourcingRequests), label: "Open sourcing", href: "/admin/sourcing", icon: Search }]
      : []),
    ...(snapshot.canViewRepairs
      ? [{ value: String(snapshot.repairJobsInProgress), label: "Repair jobs active", href: "/admin/repairs", icon: Wrench }]
      : []),
    { value: String(snapshot.repairCallsToday), label: "Appointments today", href: "/admin/diary", icon: CalendarClock },
    ...(snapshot.canViewLeads
      ? [{ value: String(snapshot.leadsRequiringFollowUp), label: "Lead follow-ups", href: "/admin/leads", icon: Clock3 }]
      : []),
    snapshot.canViewCommercial
      ? { value: formatCurrency(snapshot.estimatedGrossProfit), label: "Estimated stock gross", href: "/admin/reports", icon: CircleDollarSign }
      : { value: String(snapshot.stockReadyForSale), label: "Ready for sale", href: "/admin/stock", icon: CarFront },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={today}
        title={`Welcome back, ${firstName}.`}
        description="Live operational priorities across the dealership."
        actions={snapshot.canViewCommercial ? (
          <Button asChild size="sm">
            <Link href="/admin/stock/new">Add a vehicle</Link>
          </Button>
        ) : undefined}
      />

      {snapshot.mode === "demo" ? (
        <Notice title="Development demo" tone="info">
          These figures are demo fixtures enabled by DEALEROS_DEMO_MODE. Production never uses
          them as a substitute for dealership records.
        </Notice>
      ) : null}

      <section aria-label="Business summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Vehicles in stock"
          value={String(snapshot.vehiclesInStock)}
          detail={`${snapshot.vehiclesDueIn} due in · ${snapshot.vehiclesReserved} reserved`}
          href="/admin/stock"
          icon={CarFront}
        />
        {snapshot.canViewLeads ? (
          <MetricCard
            label="New sales leads"
            value={String(snapshot.newSalesLeads)}
            detail={`${snapshot.leadsRequiringFollowUp} need follow-up`}
            href="/admin/leads"
            icon={HeartHandshake}
            tone="warning"
          />
        ) : (
          <MetricCard
            label="Repair jobs active"
            value={String(snapshot.repairJobsInProgress)}
            detail={`${snapshot.repairCallsToday} appointments today`}
            href="/admin/repairs"
            icon={Wrench}
          />
        )}
        {snapshot.canViewCommercial ? (
          <MetricCard
            label="Gross profit this month"
            value={formatCurrency(snapshot.realisedGrossProfitThisMonth)}
            detail={`${snapshot.vehiclesSoldThisMonth} vehicles sold`}
            href="/admin/reports"
            icon={CircleDollarSign}
            tone="positive"
          />
        ) : (
          <MetricCard
            label="Appointments today"
            value={String(snapshot.repairCallsToday)}
            detail={`${snapshot.repairJobsInProgress} repair jobs active`}
            href="/admin/diary"
            icon={CalendarClock}
          />
        )}
        <MetricCard
          label="Overdue tasks"
          value={String(snapshot.overdueTasks)}
          detail="Open the task queue to prioritise work"
          href="/admin/tasks"
          icon={ListTodo}
          tone={snapshot.overdueTasks ? "critical" : "default"}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Operational summary">
        {operationalItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              href={item.href}
              key={item.label}
              className="flex items-center gap-3 rounded-2xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(20,24,18,.03)] transition hover:border-brand/30"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft">
                <Icon className="size-4 text-brand" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-lg font-extrabold leading-none">{item.value}</span>
                <span className="mt-1 block text-xs font-semibold text-foreground/48">
                  {item.label}
                </span>
              </span>
              <ArrowRight className="ml-auto size-4 text-foreground/20" />
            </Link>
          );
        })}
      </section>

      {!details ? (
        <Notice title="Some overview panels are unavailable" tone="info">
          Core metrics loaded, but the detailed lead, diary or sales panels could not be refreshed.
        </Notice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.75fr)]">
        <div className="space-y-6">
          <DataCard>
            <div className="border-b p-5">
              <SectionHeading
                title={
                  snapshot.canViewCommercial
                    ? "Sales performance"
                    : "Sales activity"
                }
                description={
                  snapshot.canViewCommercial
                    ? "Recorded vehicle sales and realised gross profit"
                    : "Commercial values are restricted to owners and managers"
                }
                action={snapshot.canViewCommercial ? (
                  <Link href="/admin/reports" className="text-xs font-extrabold text-brand hover:underline">
                    Reports
                  </Link>
                ) : undefined}
              />
            </div>
            <div className="p-5">
              {snapshot.canViewCommercial ? (
                <>
              <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <p className="text-xs font-bold text-foreground/40">Sales this month</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">
                    {snapshot.vehiclesSoldThisMonth} vehicles
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground/40">Revenue</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">
                    {formatCurrency(snapshot.salesRevenueThisMonth)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground/40">Average margin</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">
                    {formatCurrency(
                      snapshot.vehiclesSoldThisMonth
                        ? snapshot.realisedGrossProfitThisMonth / snapshot.vehiclesSoldThisMonth
                        : 0,
                    )}
                  </p>
                </div>
              </div>
              {details?.salesTrend.length ? (
                <div className="flex h-44 items-end gap-3 rounded-xl bg-surface-muted p-4">
                  {details.salesTrend.map((month) => (
                    <div key={month.key} className="flex h-full flex-1 flex-col justify-end text-center">
                      <span className="mb-1 text-[9px] font-bold text-foreground/45">
                        {month.sales} sold
                      </span>
                      <span
                        className="mx-auto w-full max-w-14 rounded-t bg-brand"
                        style={{
                          height: `${Math.max(4, (month.grossProfit / maxTrendGross) * 100)}%`,
                        }}
                        title={formatCurrency(month.grossProfit)}
                      />
                      <span className="mt-2 text-[9px] font-bold text-foreground/40">
                        {month.label}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-surface-muted p-6 text-center text-xs text-foreground/45">
                  No sales history is available for the chart period.
                </p>
              )}
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-surface-muted p-4">
                    <p className="text-xs font-bold text-foreground/40">
                      Sold this month
                    </p>
                    <p className="mt-1 text-2xl font-extrabold">
                      {snapshot.vehiclesSoldThisMonth}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-muted p-4">
                    <p className="text-xs font-bold text-foreground/40">
                      Reserved
                    </p>
                    <p className="mt-1 text-2xl font-extrabold">
                      {snapshot.vehiclesReserved}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </DataCard>

          <DataCard>
            <div className="border-b p-5">
              <SectionHeading
                title={
                  snapshot.canViewLeads
                    ? "Priority lead queue"
                    : "Service priorities"
                }
                description={
                  snapshot.canViewLeads
                    ? "Newest and highest-priority accessible enquiries"
                    : "Assigned repair work and today’s appointments"
                }
                action={
                  <Link
                    href={snapshot.canViewLeads ? "/admin/leads" : "/admin/repairs"}
                    className="text-xs font-extrabold text-brand hover:underline"
                  >
                    {snapshot.canViewLeads ? "View all leads" : "Open repairs"}
                  </Link>
                }
              />
            </div>
            {snapshot.canViewLeads && details?.leads.length ? (
              <div className="divide-y">
                {details.leads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/admin/leads?query=${encodeURIComponent(lead.reference)}`}
                    className="grid gap-3 p-4 transition hover:bg-[#fafaf8] sm:grid-cols-[minmax(0,1fr)_140px_110px] sm:items-center"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar
                        initials={lead.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold">{lead.name}</span>
                        <span className="block truncate text-xs text-foreground/45">{lead.subject}</span>
                      </span>
                    </span>
                    <StatusPill status={lead.status} />
                    <span className="text-xs font-bold text-foreground/55 sm:text-right">{lead.due}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-xs text-foreground/45">
                {snapshot.canViewLeads
                  ? "No accessible leads are waiting in the queue."
                  : `${snapshot.repairJobsInProgress} repair jobs are active and ${snapshot.repairCallsToday} appointments are scheduled today.`}
              </p>
            )}
          </DataCard>
        </div>

        <div className="space-y-6">
          <DataCard>
            <div className="border-b p-5">
              <SectionHeading
                title="Today’s diary"
                description={today}
                action={
                  <Link href="/admin/diary" className="text-xs font-extrabold text-brand hover:underline">
                    Open diary
                  </Link>
                }
              />
            </div>
            {details?.appointments.length ? (
              <div className="divide-y">
                {details.appointments.slice(0, 5).map((appointment) => (
                  <Link
                    key={appointment.id}
                    href={`/admin/diary?appointment=${appointment.id}`}
                    className="flex gap-3 p-4 transition hover:bg-[#fafaf8]"
                  >
                    <span className="w-11 shrink-0 text-xs font-extrabold text-foreground/60">
                      {appointment.time}
                    </span>
                    <span className="relative min-w-0 border-l-2 border-brand/30 pl-3">
                      <span className="block truncate text-xs font-extrabold">{appointment.title}</span>
                      <span className="mt-1 block truncate text-[11px] text-foreground/45">
                        {appointment.customer}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-xs text-foreground/45">
                No appointments are scheduled for today.
              </p>
            )}
          </DataCard>

          <DataCard>
            <div className="border-b p-5">
              <SectionHeading
                title="Stock position"
                description={
                  snapshot.canViewCommercial
                    ? `${formatCurrency(snapshot.estimatedStockValue)} invested`
                    : `${snapshot.vehiclesInStock} active vehicles`
                }
                action={
                  <Link href="/admin/stock" className="text-xs font-extrabold text-brand hover:underline">
                    Open stock
                  </Link>
                }
              />
            </div>
            <div className="space-y-4 p-5">
              {stockRows.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground/60">{item.label}</span>
                    <span className="font-extrabold">{item.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={`h-full rounded-full ${item.tone}`}
                      style={{ width: `${(item.value / stockTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {snapshot.stockAgeing60Days ? (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-950">
                  <Clock3 className="size-4 shrink-0" />
                  <span>
                    <strong>{snapshot.stockAgeing60Days} vehicles</strong> have been in stock for over 60 days.
                  </span>
                </div>
              ) : null}
            </div>
          </DataCard>
        </div>
      </div>

      <section
        aria-label="Today at a glance"
        className="grid gap-3 rounded-2xl bg-[#10231f] p-4 text-white sm:grid-cols-3 sm:p-5"
      >
        <div className="flex items-center gap-3 sm:border-r sm:border-white/10">
          <CheckCircle2 className="size-5 text-emerald-400" />
          <div>
            <p className="text-lg font-extrabold">{snapshot.tasksCompletedToday}</p>
            <p className="text-xs text-white/45">Tasks completed today</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:border-r sm:border-white/10 sm:pl-4">
          {snapshot.canViewCommercial ? (
            <HandCoins className="size-5 text-[#d6a852]" />
          ) : (
            <Wrench className="size-5 text-[#d6a852]" />
          )}
          <div>
            <p className="text-lg font-extrabold">
              {snapshot.canViewCommercial
                ? formatCurrency(snapshot.expectedGrossInNegotiation)
                : snapshot.repairJobsInProgress}
            </p>
            <p className="text-xs text-white/45">
              {snapshot.canViewCommercial
                ? "Expected gross in active negotiations"
                : "Repair jobs currently active"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:pl-4">
          <Clock3 className="size-5 text-blue-400" />
          <div>
            <p className="text-lg font-extrabold">
              {snapshot.canViewLeads
                ? details?.averageLeadResponseMinutes === null ||
                  details?.averageLeadResponseMinutes === undefined
                  ? "Not measured"
                  : `${details.averageLeadResponseMinutes} min`
                : snapshot.repairCallsToday}
            </p>
            <p className="text-xs text-white/45">
              {snapshot.canViewLeads
                ? "Average recorded lead response"
                : "Appointments scheduled today"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
