import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  FileWarning,
  HandCoins,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { TodayFocus, TodayFocusItem } from "@/lib/data/admin-today";
import { cn } from "@/lib/utils";

type Group = {
  key: keyof TodayFocus;
  label: string;
  icon: LucideIcon;
  emptyLabel: string;
};

const groups: Group[] = [
  {
    key: "followUps",
    label: "Waiting for a call back",
    icon: MessageSquare,
    emptyLabel: "Every enquiry has been followed up.",
  },
  {
    key: "awaitingApproval",
    label: "Estimates waiting on the customer",
    icon: HandCoins,
    emptyLabel: "No estimates are waiting for approval.",
  },
  {
    key: "overdueInvoices",
    label: "Invoices past their due date",
    icon: FileWarning,
    emptyLabel: "No overdue invoices — nice.",
  },
  {
    key: "agedStock",
    label: "Cars sitting for 60+ days",
    icon: AlertTriangle,
    emptyLabel: "Stock is turning over cleanly.",
  },
];

function toneClasses(emphasis?: TodayFocusItem["emphasis"]) {
  if (emphasis === "critical") return "border-red-200 bg-red-50/60";
  if (emphasis === "warning") return "border-amber-200 bg-amber-50/50";
  return "border-border bg-white";
}

function dotClasses(emphasis?: TodayFocusItem["emphasis"]) {
  if (emphasis === "critical") return "bg-red-500";
  if (emphasis === "warning") return "bg-amber-500";
  return "bg-brand";
}

export function TodayFocus({ focus }: { focus: TodayFocus }) {
  const totalItems =
    focus.followUps.length +
    focus.awaitingApproval.length +
    focus.overdueInvoices.length +
    focus.agedStock.length;

  return (
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-[#fafaf8] px-5 py-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand">
            Today
          </p>
          <p className="mt-0.5 text-sm font-extrabold">
            {totalItems === 0 && !focus.nextAppointment
              ? "You're all caught up."
              : `${totalItems} thing${totalItems === 1 ? "" : "s"} to look at`}
          </p>
        </div>
        {focus.nextAppointment ? (
          <Link
            href={focus.nextAppointment.href}
            className="group inline-flex max-w-full items-center gap-2.5 rounded-xl border border-brand/30 bg-brand-soft/50 px-3 py-2 text-xs font-extrabold text-brand-strong transition-colors hover:bg-brand-soft"
          >
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate">
                {focus.nextAppointment.title}
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-semibold text-brand-strong/70">
                {focus.nextAppointment.detail}
              </span>
            </span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-foreground/50">
            <Clock3 className="size-4" aria-hidden />
            No upcoming appointments
          </span>
        )}
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2">
        {groups.map((group) => {
          const items = focus[group.key] as TodayFocusItem[];
          const Icon = group.icon;
          return (
            <div key={group.key} className="bg-white p-5">
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-foreground/45" aria-hidden />
                <p className="text-xs font-extrabold">{group.label}</p>
                {items.length > 0 ? (
                  <span className="ml-auto rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-extrabold text-brand-strong tabular-nums">
                    {items.length}
                  </span>
                ) : null}
              </div>
              {items.length === 0 ? (
                <p className="mt-3 text-xs text-foreground/45">
                  {group.emptyLabel}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {items.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-foreground/25",
                          toneClasses(item.emphasis),
                        )}
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            dotClasses(item.emphasis),
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-extrabold">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-foreground/55">
                            {item.detail}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                  {items.length > 3 ? (
                    <li className="pt-1 text-[10px] font-semibold text-foreground/45">
                      + {items.length - 3} more
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
