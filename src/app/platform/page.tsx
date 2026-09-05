import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CarFront,
  Globe2,
  MessageSquare,
  PauseCircle,
  Plus,
  Rocket,
  Users,
} from "lucide-react";

import {
  canMutatePlatform,
  requirePlatformAdmin,
} from "@/lib/auth/platform-admin";
import {
  getPlatformOverview,
  logPlatformOverviewAccess,
  platformDealershipStatuses,
  platformThemeIds,
  platformWebsiteStatuses,
  type PlatformDirectoryQuery,
} from "@/lib/data/platform-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
function relativeFrom(iso: string | null): string {
  if (!iso) return "Never";
  const diffMinutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(diffMinutes) < 60) return relative.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 48) return relative.format(diffHours, "hour");
  return relative.format(Math.round(diffHours / 24), "day");
}

function themeLabel(themeId: string) {
  return themeId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pageHref(query: PlatformDirectoryQuery, page: number) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status !== "all") params.set("status", query.status);
  if (query.websiteStatus !== "all") {
    params.set("websiteStatus", query.websiteStatus);
  }
  if (query.themeId !== "all") params.set("themeId", query.themeId);
  params.set("sort", query.sort);
  params.set("direction", query.direction);
  params.set("pageSize", String(query.pageSize));
  params.set("page", String(page));
  return `/platform?${params.toString()}#dealerships`;
}

export default async function PlatformOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [actor, snapshot] = await Promise.all([
    requirePlatformAdmin(),
    searchParams.then((params) => getPlatformOverview(params)),
  ]);
  if (actor.role === "support") {
    await logPlatformOverviewAccess({ actor });
  }

  if (snapshot.state === "unavailable") {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
        <h1 className="text-xl font-extrabold">Live data unavailable</h1>
        <p className="mt-2 text-sm text-slate-400">{snapshot.message}</p>
      </div>
    );
  }

  const kpis = [
    [Building2, "Dealerships", snapshot.totals.dealerships, `${snapshot.totals.activeDealerships} active`],
    [Rocket, "Trials", snapshot.totals.trialDealerships, "Onboarding or evaluation"],
    [PauseCircle, "Suspended", snapshot.totals.suspendedDealerships, `${snapshot.totals.cancelledDealerships} cancelled`],
    [Globe2, "Published sites", snapshot.totals.publishedWebsites, `${snapshot.totals.unpublishedWebsites} not live`],
    [CarFront, "Vehicles", snapshot.totals.vehicles, "Across every dealership"],
    [MessageSquare, "Leads", snapshot.totals.leads, "Enquiries and opportunities"],
    [Users, "Active users", snapshot.totals.users, "Unique staff accounts"],
  ] as const;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">
            Platform admin
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            Every dealership on MOTOROS
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Operational health, website status, domains, designs and meaningful activity across the network.
          </p>
        </div>
        {canMutatePlatform(actor.role) ? (
          <Link
            href="/onboarding"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-xs font-extrabold text-slate-950 hover:bg-cyan-300"
          >
            <Plus className="size-4" aria-hidden />
            Add dealership
          </Link>
        ) : (
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Read-only support access
          </span>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([Icon, label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              <Icon className="size-3.5 text-cyan-300" aria-hidden />
              {label}
            </div>
            <p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p>
            <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
          </div>
        ))}
      </section>

      <section id="dealerships" className="rounded-2xl border border-white/10 bg-slate-900">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-lg font-extrabold">Dealership directory</h2>
          <p className="mt-1 text-xs text-slate-400">
            {snapshot.totalMatches} matching {snapshot.totalMatches === 1 ? "dealership" : "dealerships"}.
          </p>
          <form method="get" action="/platform" className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-7">
            <input
              name="q"
              defaultValue={snapshot.query.q}
              placeholder="Name, owner or domain"
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs outline-none focus:border-cyan-400 xl:col-span-2"
            />
            <select name="status" defaultValue={snapshot.query.status} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs">
              <option value="all">All statuses</option>
              {platformDealershipStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select name="websiteStatus" defaultValue={snapshot.query.websiteStatus} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs">
              <option value="all">All websites</option>
              {platformWebsiteStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select name="themeId" defaultValue={snapshot.query.themeId} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs">
              <option value="all">All designs</option>
              {platformThemeIds.map((themeId) => <option key={themeId} value={themeId}>{themeLabel(themeId)}</option>)}
            </select>
            <select name="sort" defaultValue={snapshot.query.sort} className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs">
              <option value="created">Created</option>
              <option value="name">Name</option>
              <option value="activity">Last activity</option>
              <option value="vehicles">Vehicle count</option>
              <option value="leads">Lead count</option>
            </select>
            <div className="flex gap-2">
              <input type="hidden" name="direction" value={snapshot.query.direction} />
              <input type="hidden" name="pageSize" value={snapshot.query.pageSize} />
              <button className="h-10 flex-1 rounded-lg bg-cyan-400 px-3 text-xs font-extrabold text-slate-950 hover:bg-cyan-300">Apply</button>
              <Link href="/platform#dealerships" className="grid h-10 place-items-center rounded-lg border border-slate-700 px-3 text-xs font-extrabold text-slate-300">Clear</Link>
            </div>
          </form>
        </div>

        {snapshot.dealerships.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No dealerships match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] text-left text-sm">
              <thead className="border-b border-white/10 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-5 py-3">Dealership</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Status / plan</th>
                  <th className="px-5 py-3">Domain</th>
                  <th className="px-5 py-3">Website / design</th>
                  <th className="px-5 py-3 text-right">Vehicles</th>
                  <th className="px-5 py-3 text-right">Leads</th>
                  <th className="px-5 py-3 text-right">Staff</th>
                  <th className="px-5 py-3">Activity</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {snapshot.dealerships.map((dealership) => (
                  <tr key={dealership.id} className="hover:bg-white/5">
                    <td className="px-5 py-3">
                      <Link href={`/platform/dealerships/${dealership.id}`} className="font-extrabold text-white hover:text-cyan-300">{dealership.name}</Link>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{dealership.slug} · {dealership.subdomain}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="block text-xs font-bold">{dealership.ownerName ?? "Not assigned"}</span>
                      <span className="block max-w-44 truncate text-[10px] text-slate-500">{dealership.ownerEmail ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3"><span className="block capitalize">{dealership.status}</span><span className="text-[10px] text-slate-500">{dealership.planCode}</span></td>
                    <td className="px-5 py-3"><span className="block max-w-44 truncate">{dealership.customDomain ?? `${dealership.subdomain}.*`}</span><span className="text-[10px] capitalize text-slate-500">{dealership.customDomainStatus ?? "MotorOS subdomain"}</span></td>
                    <td className="px-5 py-3"><span className="block capitalize">{dealership.websiteStatus}</span><span className="text-[10px] text-slate-500">{themeLabel(dealership.publishedThemeId)}</span></td>
                    <td className="px-5 py-3 text-right tabular-nums">{dealership.vehicleCount}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{dealership.leadCount}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{dealership.staffCount}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">{relativeFrom(dealership.lastActivityAt)}<span className="mt-0.5 block text-[10px] text-slate-600">Joined {new Date(dealership.createdAt).toLocaleDateString("en-GB")}</span></td>
                    <td className="px-5 py-3 text-right"><Link href={`/platform/dealerships/${dealership.id}`} className="inline-flex items-center gap-1 text-xs font-extrabold text-cyan-300">View <ArrowUpRight className="size-3.5" aria-hidden /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/10 p-4 text-xs text-slate-400">
          <span>Page {snapshot.page} of {snapshot.totalPages}</span>
          <div className="flex gap-2">
            {snapshot.page > 1 ? <Link href={pageHref(snapshot.query, snapshot.page - 1)} className="rounded-lg border border-slate-700 px-3 py-2 font-extrabold">Previous</Link> : null}
            {snapshot.page < snapshot.totalPages ? <Link href={pageHref(snapshot.query, snapshot.page + 1)} className="rounded-lg border border-slate-700 px-3 py-2 font-extrabold">Next</Link> : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900">
          <div className="border-b border-white/10 p-5"><h2 className="font-extrabold">Recently created</h2></div>
          <ul className="divide-y divide-white/5">
            {snapshot.recentDealerships.map((dealership) => (
              <li key={dealership.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span><Link href={`/platform/dealerships/${dealership.id}`} className="text-sm font-extrabold hover:text-cyan-300">{dealership.name}</Link><span className="block text-[10px] text-slate-500">{new Date(dealership.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</span></span>
                <span className="text-[10px] uppercase text-slate-400">{dealership.status}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-white/10 bg-slate-900">
          <div className="border-b border-white/10 p-5"><h2 className="font-extrabold">Recent meaningful activity</h2></div>
          <ul className="divide-y divide-white/5">
            {snapshot.recentActivity.slice(0, 6).map((activity, index) => (
              <li key={`${activity.organisationId}-${activity.occurredAt}-${index}`} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3"><span><Link href={`/platform/dealerships/${activity.organisationId}`} className="text-xs font-extrabold hover:text-cyan-300">{activity.organisationName}</Link><span className="ml-2 text-xs text-slate-400">{activity.action}</span></span><span className="shrink-0 text-[10px] text-slate-500">{relativeFrom(activity.occurredAt)}</span></div>
                {activity.detail ? <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">{activity.detail}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
