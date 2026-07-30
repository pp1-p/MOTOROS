import Link from "next/link";
import { ArrowUpRight, Building2, CarFront, Receipt, Users } from "lucide-react";

import { getPlatformOverview } from "@/lib/data/platform-admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview",
};

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
function relativeFrom(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) return relative.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 48) return relative.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return relative.format(diffDays, "day");
}

export default async function PlatformOverviewPage() {
  const snapshot = await getPlatformOverview();

  if (snapshot.state === "unavailable") {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
        <h1 className="text-xl font-extrabold">Live data unavailable</h1>
        <p className="mt-2 text-sm text-slate-400">
          Supabase is not reachable from this deployment.
        </p>
      </div>
    );
  }

  const kpi = [
    {
      icon: Building2,
      label: "Dealerships",
      value: String(snapshot.totals.dealerships),
      hint: `${snapshot.totals.activeDealerships} active`,
    },
    {
      icon: Users,
      label: "Users",
      value: String(snapshot.totals.users),
      hint: "Across all orgs",
    },
    {
      icon: CarFront,
      label: "Cars in stock",
      value: String(snapshot.totals.vehiclesInStock),
      hint: "Excluding sold",
    },
    {
      icon: Receipt,
      label: "Invoiced · 30d",
      value: money.format(snapshot.totals.invoicedValueLast30Days),
      hint: `${snapshot.totals.invoicesLast30Days} invoices`,
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#67e8f9]">
          Platform admin
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Every dealership on MOTOROS
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          A cross-network view of health, activity and volume. Drill into any
          dealership for the read-only summary; edits still happen inside
          their own admin.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpi.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          >
            <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">
              <tile.icon className="size-3.5 text-[#67e8f9]" aria-hidden />
              {tile.label}
            </div>
            <p className="mt-2 text-2xl font-extrabold tabular-nums">
              {tile.value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{tile.hint}</p>
          </div>
        ))}
      </section>

      <section
        id="dealerships"
        className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900"
      >
        <div className="border-b border-white/10 p-5">
          <h2 className="text-lg font-extrabold">Dealerships</h2>
          <p className="mt-1 text-xs text-slate-400">
            {snapshot.dealerships.length}{" "}
            {snapshot.dealerships.length === 1 ? "organisation" : "organisations"}{" "}
            on the platform. Click any row for the read-only detail view.
          </p>
        </div>
        {snapshot.dealerships.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No dealerships yet.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-5 py-3">Dealership</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Users</th>
                <th className="px-5 py-3 text-right">Cars</th>
                <th className="px-5 py-3 text-right">Active invoices</th>
                <th className="px-5 py-3">Last activity</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {snapshot.dealerships.map((org) => (
                <tr key={org.id} className="hover:bg-white/5">
                  <td className="px-5 py-3">
                    <Link
                      href={`/platform/dealerships/${org.id}`}
                      className="block font-extrabold text-white hover:text-[#67e8f9]"
                    >
                      {org.name}
                    </Link>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {org.slug}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        org.status === "active"
                          ? "rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300"
                          : org.status === "suspended"
                            ? "rounded-full bg-amber-900/50 px-2 py-0.5 text-[10px] font-extrabold text-amber-300"
                            : "rounded-full bg-red-900/50 px-2 py-0.5 text-[10px] font-extrabold text-red-300"
                      }
                    >
                      {org.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {org.memberCount}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {org.vehicleCount}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {org.activeInvoiceCount}
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {relativeFrom(org.lastActivityAt)}
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {new Date(org.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/platform/dealerships/${org.id}`}
                      className="inline-flex items-center gap-1 text-xs font-extrabold text-[#67e8f9] hover:text-[#a5f3fc]"
                    >
                      View
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
