import Link from "next/link";
import { ArrowUpRight, Globe2 } from "lucide-react";

import { getPlatformWebsites } from "@/lib/data/platform-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dealer websites" };

export default async function PlatformWebsitesPage() {
  const websites = await getPlatformWebsites();
  return (
    <div className="space-y-7">
      <header>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">
          Website network
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">Dealer websites</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Inspect template, hosted subdomain and custom-domain verification
          without opening dealership customer records.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="border-b border-white/10 text-left text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
              <tr>
                <th className="px-5 py-3">Dealership</th>
                <th className="px-5 py-3">Site</th>
                <th className="px-5 py-3">Template</th>
                <th className="px-5 py-3">Hosted domain</th>
                <th className="px-5 py-3">Custom domain</th>
                <th className="px-5 py-3">Last update</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {websites.map((website) => (
                <tr key={website.organisationId} className="hover:bg-white/5">
                  <td className="px-5 py-4">
                    <p className="font-extrabold">{website.dealershipName}</p>
                    <p className="mt-1 text-[10px] capitalize text-slate-500">
                      Dealership {website.organisationStatus}
                    </p>
                  </td>
                  <td className="px-5 py-4 capitalize text-slate-300">{website.siteStatus}</td>
                  <td className="px-5 py-4 capitalize text-slate-300">{website.themeId}</td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {website.hostedSubdomain
                      ? `${website.hostedSubdomain}.motoros.co.uk`
                      : "Not allocated"}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {website.customDomain ?? "Not configured"}
                    {website.customDomainStatus ? (
                      <span className="block text-[10px] capitalize text-slate-500">
                        {website.customDomainStatus}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {new Date(website.updatedAt).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/platform/dealerships/${website.organisationId}`}
                      className="inline-flex items-center gap-1 text-xs font-extrabold text-cyan-300 hover:text-cyan-100"
                    >
                      Inspect <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!websites.length ? (
          <div className="grid min-h-64 place-items-center p-8 text-center text-sm text-slate-500">
            <div>
              <Globe2 className="mx-auto mb-3 size-7" aria-hidden />
              No dealership websites are configured yet.
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
