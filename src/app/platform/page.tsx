import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CarFront,
  CirclePause,
  Handshake,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";

import { getPlatformOverview } from "@/lib/data/platform-admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Overview" };

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
function relativeFrom(iso: string | null): string {
  if (!iso) return "Never";
  const diffMinutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(diffMinutes) < 60) return relative.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 48) return relative.format(diffHours, "hour");
  return relative.format(Math.round(diffHours / 24), "day");
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

  const kpis = [
    {
      icon: Building2,
      label: "Active dealerships",
      value: String(snapshot.totals.activeDealerships),
      hint: `${snapshot.totals.dealerships} total · ${snapshot.totals.trialDealerships} trial`,
    },
    {
      icon: CirclePause,
      label: "Suspended",
      value: String(snapshot.totals.suspendedDealerships),
      hint: `${snapshot.totals.newDealershipsThisMonth} joined this month`,
    },
    {
      icon: Users,
      label: "Dealership users",
      value: String(snapshot.totals.users),
      hint: "Active memberships",
    },
    {
      icon: CarFront,
      label: "Vehicles",
      value: String(snapshot.totals.totalVehicles),
      hint: `${snapshot.totals.advertisedVehicles} currently advertised`,
    },
    {
      icon: Handshake,
      label: "Leads",
      value: String(snapshot.totals.totalLeads),
      hint: `${snapshot.totals.totalSales} recorded sales`,
    },
    {
      icon: TrendingUp,
      label: "Subscription MRR",
      value: money.format(snapshot.totals.monthlyPlatformRevenue),
      hint: "Configured subscription values",
    },
    {
      icon: Receipt,
      label: "Dealer invoices · 30d",
      value: money.format(snapshot.totals.invoicedValueLast30Days),
      hint: `${snapshot.totals.invoicesLast30Days} invoices`,
    },
    {
      icon: CarFront,
      label: "Cars in stock",
      value: String(snapshot.totals.vehiclesInStock),
      hint: "Across every dealership",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#67e8f9]">
          Platform admin
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Every dealership on MOTOR.OS
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Network health, activity, subscriptions, websites and integrations
          from one protected control centre.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          >
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
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

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 className="text-lg font-extrabold">Recently joined dealerships</h2>
            <p className="mt-1 text-xs text-slate-400">
              Subscription, website and activity at a glance.
            </p>
          </div>
          <Link
            href="/platform/dealerships"
            className="text-xs font-extrabold text-[#67e8f9] hover:text-[#a5f3fc]"
          >
            Open directory
          </Link>
        </div>
        {snapshot.dealerships.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No dealerships yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-5 py-3">Dealership</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Users</th>
                  <th className="px-5 py-3 text-right">Cars</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Website</th>
                  <th className="px-5 py-3">Last activity</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {snapshot.dealerships.slice(0, 6).map((org) => (
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
                    <td className="px-5 py-3 capitalize text-slate-300">
                      {org.status}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {org.memberCount}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {org.vehicleCount}
                    </td>
                    <td className="px-5 py-3 capitalize text-slate-300">
                      {org.planCode}
                      <span className="block text-[10px] text-slate-500">
                        {org.subscriptionStatus.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 capitalize text-slate-300">
                      {org.websiteStatus}
                      <span className="block text-[10px] text-slate-500">
                        {org.websiteTheme}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {relativeFrom(org.lastActivityAt)}
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
          </div>
        )}
      </section>
    </div>
  );
}
