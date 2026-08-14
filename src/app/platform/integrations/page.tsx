import { AlertTriangle, Cable, CheckCircle2, RefreshCw } from "lucide-react";

import { getPlatformIntegrationHealth } from "@/lib/data/platform-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integration health" };

export default async function PlatformIntegrationsPage() {
  const providers = await getPlatformIntegrationHealth();
  const totals = providers.reduce(
    (result, provider) => ({
      connected: result.connected + provider.connected,
      actionRequired: result.actionRequired + provider.actionRequired,
      errors: result.errors + provider.errors,
    }),
    { connected: 0, actionRequired: 0, errors: 0 },
  );

  return (
    <div className="space-y-7">
      <header>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">
          Network operations
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">Integration health</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Aggregate connection state across dealerships. Account tokens and
          secret references are deliberately excluded from this view.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: CheckCircle2, label: "Connected", value: totals.connected, tone: "text-emerald-300" },
          { icon: RefreshCw, label: "Action required", value: totals.actionRequired, tone: "text-amber-300" },
          { icon: AlertTriangle, label: "Errors", value: totals.errors, tone: "text-red-300" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <item.icon className={`size-5 ${item.tone}`} aria-hidden />
            <p className="mt-4 text-3xl font-extrabold tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs text-slate-400">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map((provider) => (
          <article key={provider.provider} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300">
                <Cable className="size-5" aria-hidden />
              </span>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-extrabold text-slate-400">
                {provider.configured} configured
              </span>
            </div>
            <h2 className="mt-4 font-extrabold capitalize">{provider.name}</h2>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-400/10 p-3">
                <dt className="text-[9px] uppercase text-emerald-300">Connected</dt>
                <dd className="mt-1 text-lg font-extrabold">{provider.connected}</dd>
              </div>
              <div className="rounded-xl bg-amber-400/10 p-3">
                <dt className="text-[9px] uppercase text-amber-300">Reconnect</dt>
                <dd className="mt-1 text-lg font-extrabold">{provider.actionRequired}</dd>
              </div>
              <div className="rounded-xl bg-red-400/10 p-3">
                <dt className="text-[9px] uppercase text-red-300">Errors</dt>
                <dd className="mt-1 text-lg font-extrabold">{provider.errors}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}
