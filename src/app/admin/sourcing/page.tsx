import {
  ArrowRight,
  CircleDollarSign,
  Clock3,
  Search,
} from "lucide-react";

import { PageHeader } from "@/components/admin/page-kit";
import { SourcingWorkspace } from "@/components/admin/sourcing-workspace";
import { hasPermission, requireStaff } from "@/lib/auth/permissions";
import { getAdminSourcingList } from "@/lib/data/admin-operational";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function SourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; request?: string }>;
}) {
  const params = await searchParams;
  const staff = await requireStaff("sourcing:view");
  const { requests, metrics } = await getAdminSourcingList();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Concierge buying"
        title="Car sourcing"
        description="Manage customer briefs, search progress, decisions, fees and expected margin."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [Search, String(metrics.open), "Open searches"],
          [
            Clock3,
            metrics.averageDaysToFirstOption === null
              ? "—"
              : `${metrics.averageDaysToFirstOption} days`,
            "Avg. to first option",
          ],
          [
            CircleDollarSign,
            formatCurrency(metrics.expectedMargin),
            "Expected margin",
          ],
          [ArrowRight, `${metrics.successRate}%`, "Success rate"],
        ].map(([Icon, value, label]) => {
          const Component = Icon as typeof Search;
          return (
            <div key={String(label)} className="rounded-xl border bg-white p-4">
              <Component className="size-4 text-brand" />
              <p className="mt-3 text-lg font-extrabold">{String(value)}</p>
              <p className="text-[10px] text-foreground/45">{String(label)}</p>
            </div>
          );
        })}
      </div>
      <SourcingWorkspace
        requests={requests}
        canManage={hasPermission(staff.role, "sourcing:manage")}
        initialRequest={params.query ?? params.request}
      />
    </div>
  );
}
