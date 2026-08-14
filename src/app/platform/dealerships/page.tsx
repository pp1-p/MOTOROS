import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";

import { getPlatformOverview } from "@/lib/data/platform-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dealerships" };

type Filters = {
  q?: string;
  status?: string;
  plan?: string;
  website?: string;
  social?: string;
};

export default async function PlatformDealershipDirectory({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const [snapshot, filters] = await Promise.all([
    getPlatformOverview(),
    searchParams,
  ]);
  const query = filters.q?.trim().toLowerCase() ?? "";
  const dealerships = snapshot.dealerships.filter((dealership) => {
    if (
      query &&
      ![
        dealership.name,
        dealership.slug,
        dealership.email ?? "",
        dealership.telephone ?? "",
        dealership.location ?? "",
      ].some((value) => value.toLowerCase().includes(query))
    ) {
      return false;
    }
    if (filters.status && dealership.status !== filters.status) return false;
    if (filters.plan && dealership.planCode !== filters.plan) return false;
    if (
      filters.website === "enabled" &&
      ["disabled", "unconfigured"].includes(dealership.websiteStatus)
    ) {
      return false;
    }
    if (
      filters.website === "disabled" &&
      !["disabled", "unconfigured"].includes(dealership.websiteStatus)
    ) {
      return false;
    }
    if (filters.social === "connected" && !dealership.integrationProviders.length) {
      return false;
    }
    if (filters.social === "none" && dealership.integrationProviders.length) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-7">
      <header>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#67e8f9]">
          Platform directory
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Dealerships
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Search every MOTOR.OS tenant and inspect subscription, stock, website
          and integration state without crossing dealership data boundaries.
        </p>
      </header>

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 md:grid-cols-5">
        <label className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 size-4 text-slate-500" aria-hidden />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Search name, email, telephone or location"
            className="h-10 w-full rounded-xl border border-white/10 bg-slate-950 pl-10 pr-3 text-xs text-white placeholder:text-slate-600"
          />
        </label>
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-white"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          name="plan"
          defaultValue={filters.plan ?? ""}
          className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-white"
        >
          <option value="">All plans</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="premium">Premium</option>
          <option value="custom">Custom</option>
        </select>
        <button className="h-10 rounded-xl bg-cyan-300 px-4 text-xs font-extrabold text-slate-950 hover:bg-cyan-200">
          Apply filters
        </button>
        <select
          name="website"
          defaultValue={filters.website ?? ""}
          className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-white"
        >
          <option value="">Any website</option>
          <option value="enabled">Website enabled</option>
          <option value="disabled">No website</option>
        </select>
        <select
          name="social"
          defaultValue={filters.social ?? ""}
          className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-white"
        >
          <option value="">Any social state</option>
          <option value="connected">Integration connected</option>
          <option value="none">No connections</option>
        </select>
      </form>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <div className="border-b border-white/10 p-5">
          <h2 className="font-extrabold">
            {dealerships.length} {dealerships.length === 1 ? "dealership" : "dealerships"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-sm">
            <thead className="border-b border-white/10 text-left text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
              <tr>
                <th className="px-5 py-3">Dealership</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3 text-right">Staff</th>
                <th className="px-5 py-3 text-right">Vehicles</th>
                <th className="px-5 py-3 text-right">Sold</th>
                <th className="px-5 py-3">Website</th>
                <th className="px-5 py-3">Integrations</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {dealerships.map((dealership) => (
                <tr key={dealership.id} className="align-top hover:bg-white/5">
                  <td className="px-5 py-4">
                    <p className="font-extrabold text-white">{dealership.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {dealership.id}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {dealership.location ?? "No location"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-300">
                    <p>{dealership.email ?? "—"}</p>
                    <p className="mt-1 text-slate-500">{dealership.telephone ?? "—"}</p>
                  </td>
                  <td className="px-5 py-4 capitalize text-slate-300">
                    {dealership.status}
                  </td>
                  <td className="px-5 py-4 capitalize text-slate-300">
                    {dealership.planCode}
                    <span className="block text-[10px] text-slate-500">
                      {dealership.subscriptionStatus.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {dealership.memberCount}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {dealership.vehicleCount}
                    <span className="block text-[10px] text-slate-500">
                      {dealership.advertisedVehicleCount} advertised
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">
                    {dealership.soldVehicleCount}
                  </td>
                  <td className="px-5 py-4 capitalize text-slate-300">
                    {dealership.websiteStatus}
                    <span className="block text-[10px] text-slate-500">
                      {dealership.websiteTheme}
                    </span>
                  </td>
                  <td className="max-w-48 px-5 py-4 text-xs text-slate-400">
                    {dealership.integrationProviders.length
                      ? dealership.integrationProviders.join(", ").replaceAll("_", " ")
                      : "None connected"}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {new Date(dealership.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/platform/dealerships/${dealership.id}`}
                      className="inline-flex items-center gap-1 text-xs font-extrabold text-cyan-300 hover:text-cyan-100"
                    >
                      View <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!dealerships.length ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No dealerships match those filters.
          </p>
        ) : null}
      </section>
    </div>
  );
}
