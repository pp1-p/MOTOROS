import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CarFront,
  ClipboardList,
  Globe2,
  Mail,
  MapPin,
  MessageSquare,
  Palette,
  Phone,
  Receipt,
  Users,
} from "lucide-react";

import { PlatformDealershipControls } from "@/components/platform/platform-dealership-controls";
import {
  canMutatePlatform,
  requirePlatformAdmin,
} from "@/lib/auth/platform-admin";
import {
  getPlatformDealership,
  logPlatformAdminAccess,
} from "@/lib/data/platform-admin";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function PlatformDealershipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePlatformAdmin();
  const { id } = await params;
  const dealership = await getPlatformDealership(id);
  if (!dealership) notFound();

  await logPlatformAdminAccess({ organisationId: dealership.id, actor });

  const kpis = [
    [CarFront, "Vehicles", dealership.inventory.total, `${dealership.inventory.inStock} in stock`],
    [MessageSquare, "Leads", dealership.leads.total, `${dealership.leads.open} open`],
    [Users, "Staff", dealership.members.length, `${dealership.members.filter((member) => member.status === "active").length} active`],
    [Receipt, "Invoices", dealership.invoices.total, `${money.format(dealership.invoices.outstandingBalance)} outstanding`],
    [Globe2, "Website pages", dealership.websitePages.total, `${dealership.websitePages.published} published`],
    [Palette, "Live design", label(dealership.branding.publishedThemeId), `${label(dealership.branding.fontPreset)} type`],
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/platform#dealerships" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-400 hover:text-white">
          <ArrowLeft className="size-3.5" aria-hidden />
          All dealerships
        </Link>
        <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">Dealership</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{dealership.name}</h1>
            <p className="mt-1 text-xs text-slate-400">
              {dealership.slug} · {dealership.subdomain} · joined {new Date(dealership.createdAt).toLocaleDateString("en-GB", { dateStyle: "long" })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-extrabold uppercase tracking-wider">
            <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1.5">{dealership.status}</span>
            <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1.5">{dealership.planCode}</span>
            <span className="rounded-full border border-white/10 bg-slate-900 px-3 py-1.5">Site {dealership.websiteStatus}</span>
          </div>
        </header>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([Icon, metricLabel, value, hint]) => (
          <div key={metricLabel} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><Icon className="size-3.5 text-cyan-300" aria-hidden />{metricLabel}</div>
            <p className="mt-2 truncate text-xl font-extrabold tabular-nums" title={String(value)}>{value}</p>
            <p className="mt-1 text-[10px] text-slate-500">{hint}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-slate-900">
            <div className="border-b border-white/10 p-5"><h2 className="text-lg font-extrabold"><Users className="mr-2 inline size-4 text-cyan-300" aria-hidden />Team ({dealership.members.length})</h2></div>
            {dealership.members.length === 0 ? <p className="p-6 text-sm text-slate-500">No accepted team members yet.</p> : (
              <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b border-white/10 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Person</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Joined</th></tr></thead><tbody className="divide-y divide-white/5">{dealership.members.map((member) => <tr key={member.userId}><td className="px-5 py-3"><p className="font-extrabold">{member.displayName ?? "Unnamed"}</p><p className="text-[11px] text-slate-500">{member.email ?? "—"}</p></td><td className="px-5 py-3 capitalize text-slate-300">{label(member.role)}</td><td className="px-5 py-3 capitalize text-slate-400">{member.status}</td><td className="px-5 py-3 text-slate-400">{member.joinedAt ? new Date(member.joinedAt).toLocaleDateString("en-GB") : "—"}</td></tr>)}</tbody></table></div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900">
            <div className="border-b border-white/10 p-5"><h2 className="text-lg font-extrabold"><ClipboardList className="mr-2 inline size-4 text-cyan-300" aria-hidden />Audit history</h2><p className="mt-1 text-xs text-slate-400">The latest operational and platform events.</p></div>
            {dealership.recentActivity.length === 0 ? <p className="p-6 text-sm text-slate-500">No audit events yet.</p> : <ul className="divide-y divide-white/5">{dealership.recentActivity.map((entry, index) => <li key={`${entry.occurredAt}-${index}`} className="px-5 py-3"><div className="flex items-start justify-between gap-3"><span className="text-sm font-extrabold">{entry.action}</span><span className="shrink-0 text-[10px] text-slate-500">{new Date(entry.occurredAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span></div>{entry.detail ? <p className="mt-1 text-xs text-slate-400">{entry.detail}</p> : null}{entry.actorEmail ? <p className="mt-1 text-[10px] text-slate-500">by {entry.actorEmail}</p> : null}</li>)}</ul>}
          </section>

          {canMutatePlatform(actor.role) ? <PlatformDealershipControls dealership={dealership} /> : null}
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-slate-400">Contact details</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {dealership.contact.telephone ? <li className="flex gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden /><span>{dealership.contact.telephone}</span></li> : null}
              {dealership.contact.email ? <li className="flex gap-3"><Mail className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden /><span className="break-all">{dealership.contact.email}</span></li> : null}
              {dealership.contact.address ? <li className="flex gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden /><span>{dealership.contact.address}</span></li> : null}
              {!dealership.contact.telephone && !dealership.contact.email && !dealership.contact.address ? <li className="text-xs text-slate-500">Public contact details are incomplete.</li> : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-slate-400">Domains</h2>
            <ul className="mt-4 space-y-3">{dealership.domains.map((domain) => <li key={domain.id} className="rounded-xl border border-white/10 p-3"><p className="break-all text-xs font-extrabold">{domain.hostname}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{domain.type} · {domain.status}</p>{domain.verifiedAt ? <p className="mt-1 text-[10px] text-emerald-300">Verified {new Date(domain.verifiedAt).toLocaleDateString("en-GB")}</p> : null}</li>)}</ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-slate-400">Website design</h2>
            <dl className="mt-4 space-y-3 text-xs"><div><dt className="text-slate-500">Published</dt><dd className="mt-0.5 font-extrabold">{label(dealership.branding.publishedThemeId)}</dd></div><div><dt className="text-slate-500">Draft</dt><dd className="mt-0.5 font-extrabold">{label(dealership.branding.draftThemeId)}</dd></div><div><dt className="text-slate-500">Font preset</dt><dd className="mt-0.5 font-extrabold">{label(dealership.branding.fontPreset)}</dd></div></dl>
            {dealership.themePublications.length ? <div className="mt-4 border-t border-white/10 pt-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Recent publications</p><ul className="mt-2 space-y-2">{dealership.themePublications.slice(0, 4).map((publication) => <li key={publication.id} className="text-[10px] text-slate-400"><span className="font-bold text-slate-200">{label(publication.themeId)}</span> · {new Date(publication.publishedAt).toLocaleDateString("en-GB")}</li>)}</ul></div> : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 text-xs leading-5 text-slate-400">
            <h2 className="font-extrabold uppercase tracking-[0.14em] text-slate-300">Onboarding</h2>
            <p className="mt-3">Step: <span className="font-bold text-white">{label(dealership.onboardingStep)}</span></p>
            <p>Completed: {dealership.onboardingCompletedAt ? new Date(dealership.onboardingCompletedAt).toLocaleString("en-GB") : "Not yet"}</p>
            {!canMutatePlatform(actor.role) ? <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-950/30 p-3 text-cyan-100">Support access is intentionally read-only. Every dealership detail visit is awaited and recorded in its audit log.</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
