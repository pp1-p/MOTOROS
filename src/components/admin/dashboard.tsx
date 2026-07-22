import Link from "next/link";
import {
  CalendarClock,
  CarFront,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  ListTodo,
  Search,
  Wrench,
} from "lucide-react";

import {
  Avatar,
  DataCard,
  EmptyState,
  Notice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "@/components/admin/page-kit";
import type {
  AdminDiaryAppointment,
  AdminLeadListItem,
} from "@/lib/types/admin-operational";
import type { DashboardSnapshot } from "@/lib/data/dashboard";

type DashboardDetails = {
  leads: AdminLeadListItem[];
  appointments: AdminDiaryAppointment[];
  averageLeadResponseMinutes: number | null;
};

type AttentionItem = {
  label: string;
  detail: string;
  href: string;
  icon: typeof ListTodo;
  tone: string;
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
          eyebrow="Today"
          title="Today is unavailable"
          description="Live dealership priorities will appear here after the database connection is restored."
        />
        <Notice title="No production data is being substituted" tone="info">
          The page is intentionally empty because live dealership data could not be loaded.
        </Notice>
        <EmptyState
          title="Reconnect the operational database"
          description="Check Supabase and your dealership membership before relying on this page."
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
  const attentionItems: AttentionItem[] = [];

  if (snapshot.overdueTasks > 0) {
    attentionItems.push({
      label: `${snapshot.overdueTasks} overdue ${snapshot.overdueTasks === 1 ? "task" : "tasks"}`,
      detail: "Review the task queue and decide what needs doing first.",
      href: "/admin/tasks",
      icon: ListTodo,
      tone: "bg-red-50 text-red-700",
    });
  }
  if (snapshot.canViewLeads && snapshot.leadsRequiringFollowUp > 0) {
    attentionItems.push({
      label: `${snapshot.leadsRequiringFollowUp} ${snapshot.leadsRequiringFollowUp === 1 ? "enquiry needs" : "enquiries need"} a response`,
      detail: "Open the follow-up queue and contact the customer.",
      href: "/admin/leads",
      icon: HeartHandshake,
      tone: "bg-amber-50 text-amber-700",
    });
  }
  if (snapshot.vehiclesDueIn > 0) {
    attentionItems.push({
      label: `${snapshot.vehiclesDueIn} ${snapshot.vehiclesDueIn === 1 ? "vehicle is" : "vehicles are"} due in`,
      detail: "Prepare the arrival, inspection and photography work.",
      href: "/admin/stock",
      icon: CarFront,
      tone: "bg-blue-50 text-blue-700",
    });
  }
  if (snapshot.stockAgeing60Days > 0) {
    attentionItems.push({
      label: `${snapshot.stockAgeing60Days} ageing ${snapshot.stockAgeing60Days === 1 ? "vehicle" : "vehicles"}`,
      detail: "These vehicles have been in stock for more than 60 days.",
      href: "/admin/stock",
      icon: Clock3,
      tone: "bg-violet-50 text-violet-700",
    });
  }
  if (snapshot.canViewSourcing && snapshot.openSourcingRequests > 0) {
    attentionItems.push({
      label: `${snapshot.openSourcingRequests} open sourcing ${snapshot.openSourcingRequests === 1 ? "request" : "requests"}`,
      detail: "Check candidates and update the customer.",
      href: "/admin/sourcing",
      icon: Search,
      tone: "bg-emerald-50 text-emerald-700",
    });
  }

  const summaryItems = [
    {
      value: snapshot.vehiclesInStock,
      label: "Vehicles in stock",
      href: "/admin/stock",
      icon: CarFront,
    },
    snapshot.canViewLeads
      ? {
          value: snapshot.newSalesLeads,
          label: "New enquiries",
          href: "/admin/leads",
          icon: HeartHandshake,
        }
      : {
          value: snapshot.repairJobsInProgress,
          label: "Active repair jobs",
          href: "/admin/repairs",
          icon: Wrench,
        },
    {
      value: snapshot.repairCallsToday,
      label: "Appointments today",
      href: "/admin/diary",
      icon: CalendarClock,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={today}
        title={`Good to see you, ${firstName}.`}
        description="Start with what needs attention today. Everything else is grouped into the relevant workspace."
      />

      {snapshot.mode === "demo" ? (
        <Notice title="Development demo" tone="info">
          These figures are demo fixtures. Production never substitutes them for dealership records.
        </Notice>
      ) : null}

      <DataCard>
        <div className="border-b p-5">
          <SectionHeading
            title="Needs attention"
            description="Only work that may need action is shown here."
            action={
              <Link
                href="/admin/tasks"
                className="text-xs font-extrabold text-brand hover:underline"
              >
                Open all tasks
              </Link>
            }
          />
        </div>
        {attentionItems.length ? (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {attentionItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-start gap-3 rounded-xl border p-4 transition hover:border-brand/35 hover:bg-[#fafaf8]"
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.tone}`}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-foreground/48">
                      {item.detail}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-5 text-sm">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-extrabold">You are up to date</p>
              <p className="mt-0.5 text-xs text-foreground/48">
                Nothing currently needs urgent attention.
              </p>
            </div>
          </div>
        )}
      </DataCard>

      {!details ? (
        <Notice title="Some live details are unavailable" tone="info">
          The main priorities loaded, but the diary or enquiry list could not be refreshed.
        </Notice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <DataCard>
          <div className="border-b p-5">
            <SectionHeading
              title="Today’s diary"
              description={`${details?.appointments.length ?? 0} scheduled ${details?.appointments.length === 1 ? "appointment" : "appointments"}`}
              action={
                <Link
                  href="/admin/diary"
                  className="text-xs font-extrabold text-brand hover:underline"
                >
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
                  <span className="min-w-0 border-l-2 border-brand/30 pl-3">
                    <span className="block truncate text-xs font-extrabold">
                      {appointment.title}
                    </span>
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
              title={snapshot.canViewLeads ? "Priority enquiries" : "Workshop"}
              description={
                snapshot.canViewLeads
                  ? "The newest accessible customer enquiries"
                  : "Your current repair workload"
              }
              action={
                <Link
                  href={snapshot.canViewLeads ? "/admin/leads" : "/admin/repairs"}
                  className="text-xs font-extrabold text-brand hover:underline"
                >
                  {snapshot.canViewLeads ? "Open enquiries" : "Open workshop"}
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
                  className="flex items-center gap-3 p-4 transition hover:bg-[#fafaf8]"
                >
                  <Avatar
                    initials={lead.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{lead.name}</span>
                    <span className="block truncate text-xs text-foreground/45">
                      {lead.subject}
                    </span>
                  </span>
                  <StatusPill status={lead.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <p className="text-3xl font-extrabold">
                {snapshot.canViewLeads ? 0 : snapshot.repairJobsInProgress}
              </p>
              <p className="mt-1 text-xs text-foreground/48">
                {snapshot.canViewLeads
                  ? "No enquiries are waiting in the queue."
                  : "Repair jobs are currently active."}
              </p>
            </div>
          )}
        </DataCard>
      </div>

      <section aria-label="At a glance" className="grid gap-3 sm:grid-cols-3">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl border bg-white p-4 transition hover:border-brand/35"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-lg font-extrabold">{item.value}</span>
                <span className="block text-xs font-semibold text-foreground/48">
                  {item.label}
                </span>
              </span>
            </Link>
          );
        })}
      </section>

      <Link
        href="/admin/stock/advertising"
        className="flex items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-brand-soft/45 p-5 transition hover:border-brand/40"
      >
        <span>
          <span className="block text-sm font-extrabold">Stock advertising</span>
          <span className="mt-1 block text-xs text-foreground/50">
            Review website adverts and prepare vehicles for Auto Trader.
          </span>
        </span>
        <span className="text-xs font-extrabold text-brand">Open advertising</span>
      </Link>
    </div>
  );
}
