import { Suspense } from "react";

import { LeadsWorkspace } from "@/components/admin/leads-workspace";
import { PageHeader } from "@/components/admin/page-kit";
import { getAdminLeadList } from "@/lib/data/admin-operational";

export default async function LeadsPage() {
  const { leads, metrics } = await getAdminLeadList();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer demand"
        title="Leads"
        description="One queue for vehicle enquiries, callbacks, test drives, part exchanges and general sales opportunities."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [String(metrics.open), "Open leads"],
          [String(metrics.newToday), "New today"],
          [
            metrics.averageResponseMinutes === null
              ? "—"
              : `${metrics.averageResponseMinutes} min`,
            "Avg. response",
          ],
          [`${metrics.conversionRate}%`, "Conversion"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl border bg-white p-3.5">
            <p className="text-lg font-extrabold tracking-[-0.03em]">{value}</p>
            <p className="mt-0.5 text-[11px] text-foreground/45">{label}</p>
          </div>
        ))}
      </div>
      <Suspense fallback={<div className="min-h-96 rounded-2xl border bg-white" />}>
        <LeadsWorkspace leads={leads} metrics={metrics} />
      </Suspense>
    </div>
  );
}
