import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  Inbox,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.18em] text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance text-2xl font-extrabold tracking-[-0.035em] text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-foreground/58">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  trend,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  trend?: "up" | "down";
  tone?: "default" | "positive" | "warning" | "critical";
}) {
  const tones = {
    default: "bg-white text-foreground",
    positive: "bg-[#edf8f3] text-emerald-950",
    warning: "bg-[#fff8e8] text-amber-950",
    critical: "bg-[#fff1ee] text-red-950",
  };

  return (
    <Link
      href={href}
      className={cn(
        "group rounded-2xl border p-4 shadow-[0_1px_2px_rgba(20,24,18,.03)] transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_12px_30px_rgba(20,24,18,.08)]",
        tones[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl border border-current/10 bg-white/60 p-2.5">
          <Icon className="size-4 opacity-70" aria-hidden="true" />
        </div>
        <ChevronRight
          className="size-4 opacity-25 transition group-hover:translate-x-0.5 group-hover:opacity-60"
          aria-hidden="true"
        />
      </div>
      <p className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">{value}</p>
      <p className="mt-0.5 text-sm font-bold">{label}</p>
      <p className="mt-2 flex items-center gap-1 text-xs opacity-55">
        {trend === "up" ? <ArrowUpRight className="size-3.5" /> : null}
        {trend === "down" ? <ArrowDownRight className="size-3.5" /> : null}
        {detail}
      </p>
    </Link>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-extrabold tracking-[-0.02em]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-foreground/50">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function DataCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-foreground/[0.09] shadow-none", className)}>
      {children}
    </Card>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-y bg-[#fafaf8] text-[11px] font-extrabold uppercase tracking-[0.1em] text-foreground/45">
      {children}
    </thead>
  );
}

export function StatusPill({ status }: { status: string }) {
  const value = status.toLowerCase();
  let variant: "default" | "success" | "warning" | "danger" | "info" = "default";

  if (
    ["won", "sold", "completed", "ready", "collected", "published", "connected"].some(
      (term) => value.includes(term),
    )
  ) {
    variant = "success";
  } else if (
    ["new", "diagnosing", "progress", "active", "qualified", "booked", "syncing"].some(
      (term) => value.includes(term),
    )
  ) {
    variant = "info";
  } else if (
    ["overdue", "failed", "cancelled", "lost", "unavailable", "error"].some((term) =>
      value.includes(term),
    )
  ) {
    variant = "danger";
  } else if (
    ["awaiting", "preparation", "required", "reserved", "attempted", "due", "ordered"].some(
      (term) => value.includes(term),
    )
  ) {
    variant = "warning";
  }

  return <Badge variant={variant}>{status}</Badge>;
}

export function Avatar({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-extrabold text-brand-strong",
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-white px-6 text-center">
      <div className="rounded-2xl bg-surface-muted p-4">
        <Inbox className="size-6 text-foreground/40" aria-hidden="true" />
      </div>
      <h2 className="mt-4 font-extrabold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-foreground/55">{description}</p>
      {actionHref && actionLabel ? (
        <Button asChild size="sm" className="mt-5">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function Notice({
  title,
  children,
  tone = "warning",
}: {
  title: string;
  children: ReactNode;
  tone?: "warning" | "info";
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-4 text-sm",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-blue-200 bg-blue-50 text-blue-950",
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-extrabold">{title}</p>
        <div className="mt-1 text-xs leading-5 opacity-75">{children}</div>
      </div>
    </div>
  );
}

export function SegmentedLinks({
  items,
  active,
}: {
  items: { label: string; href: string; count?: number }[];
  active: string;
}) {
  return (
    <nav aria-label="Page views" className="inline-flex flex-wrap rounded-xl bg-surface-muted p-1">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-extrabold transition",
            item.label.toLowerCase() === active.toLowerCase()
              ? "bg-white text-foreground shadow-sm"
              : "text-foreground/50 hover:text-foreground",
          )}
        >
          {item.label}
          {item.count !== undefined ? (
            <span className="ml-1.5 text-[10px] opacity-55">{item.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

