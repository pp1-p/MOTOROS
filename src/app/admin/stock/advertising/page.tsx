import Link from "next/link";
import {
  ArrowRight,
  CarFront,
  CheckCircle2,
  Cloud,
  Globe2,
  TriangleAlert,
} from "lucide-react";

import {
  DataCard,
  Notice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { getAdminVehicleInventory } from "@/lib/data/admin-vehicles";
import { getAutoTraderConfigurationStatus } from "@/lib/integrations/autotrader";

const inactiveStatuses = new Set(["Sold", "Returned", "Archived"]);

function advertIssues(
  vehicle: Awaited<ReturnType<typeof getAdminVehicleInventory>>["vehicles"][number],
  photoCount: number,
) {
  const issues: string[] = [];

  if (!vehicle.registration || vehicle.registration === "Unregistered") {
    issues.push("Add the registration");
  }
  if (!vehicle.make || !vehicle.model) {
    issues.push("Complete the vehicle identity");
  }
  if (vehicle.price <= 0) {
    issues.push("Add a retail price");
  }
  const description = vehicle.description?.trim() ?? "";
  if (!description || description.includes("being prepared by our team")) {
    issues.push("Write the advert description");
  }
  if (photoCount === 0) {
    issues.push("Add vehicle photographs");
  }
  if (!["Ready for sale", "On forecourt"].includes(vehicle.status)) {
    issues.push("Finish vehicle preparation");
  }

  return issues;
}

export default async function StockAdvertisingPage() {
  const { vehicles, photosByVehicle } = await getAdminVehicleInventory();
  const autoTrader = getAutoTraderConfigurationStatus();
  const activeVehicles = vehicles.filter(
    (vehicle) => !inactiveStatuses.has(vehicle.status),
  );
  const rows = activeVehicles.map((vehicle) => {
    const issues = advertIssues(
      vehicle,
      photosByVehicle[vehicle.id]?.length ?? 0,
    );

    return {
      vehicle,
      issues,
      ready: issues.length === 0,
    };
  });
  const readyCount = rows.filter((row) => row.ready).length;
  const needsAttentionCount = rows.length - readyCount;
  const connected = autoTrader.status === "connected";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stock"
        title="Advertising"
        description="Prepare each vehicle once, then control where it is advertised."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/stock">Back to stock</Link>
          </Button>
        }
      />

      {!connected ? (
        <Notice title="Auto Trader is not connected" tone="info">
          This page checks whether your stock is ready to advertise. It does not publish,
          import or claim live Auto Trader data until authorised Connect access has been
          configured and verified.
        </Notice>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <DataCard>
          <div className="flex items-start gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Globe2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-extrabold">MOTOROS website</h2>
                <StatusPill status="Available" />
              </div>
              <p className="mt-2 text-xs leading-5 text-foreground/48">
                Website adverts are controlled from each vehicle’s Advert tab.
              </p>
            </div>
          </div>
        </DataCard>

        <DataCard>
          <div className="flex items-start gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Cloud className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-extrabold">Auto Trader Connect</h2>
                <StatusPill status={autoTrader.status.replaceAll("_", " ")} />
              </div>
              <p className="mt-2 text-xs leading-5 text-foreground/48">
                {autoTrader.message}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href="https://portal.autotrader.co.uk/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Auto Trader Portal
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a
                    href="https://www.autotrader.co.uk/partners/retailer/platform/autotrader-connect"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Request Connect access
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </DataCard>
      </section>

      <section aria-label="Advertising summary" className="grid gap-3 sm:grid-cols-3">
        {[
          [String(activeVehicles.length), "Active vehicles"],
          [String(readyCount), "Ready to advertise"],
          [String(needsAttentionCount), "Need attention"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-2xl border bg-white p-4">
            <p className="text-2xl font-extrabold tracking-[-0.03em]">{value}</p>
            <p className="mt-1 text-xs font-semibold text-foreground/48">{label}</p>
          </div>
        ))}
      </section>

      <DataCard>
        <div className="border-b p-5">
          <SectionHeading
            title="Vehicle advert readiness"
            description="Fix the missing essentials before attempting to publish to any channel."
            action={
              <Link
                href="/admin/stock/new"
                className="text-xs font-extrabold text-brand hover:underline"
              >
                Add vehicle
              </Link>
            }
          />
        </div>
        {rows.length ? (
          <div className="divide-y">
            {rows.map(({ vehicle, issues, ready }) => (
              <Link
                key={vehicle.id}
                href={`/admin/stock/${vehicle.id}`}
                className="grid gap-3 p-4 transition hover:bg-[#fafaf8] sm:grid-cols-[minmax(0,1fr)_130px_minmax(200px,1fr)_auto] sm:items-center"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-muted">
                    <CarFront className="size-4 text-brand" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold">
                      {vehicle.title}
                    </span>
                    <span className="block truncate text-xs text-foreground/45">
                      {vehicle.registration} · {vehicle.stockNumber}
                    </span>
                  </span>
                </span>
                <StatusPill status={vehicle.isPublic ? "Website live" : "Website draft"} />
                <span className="flex items-start gap-2 text-xs leading-5 text-foreground/55">
                  {ready ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <TriangleAlert
                      className="mt-0.5 size-4 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {ready
                      ? "Ready for advertising review"
                      : issues.slice(0, 2).join(" · ")}
                    {issues.length > 2 ? ` · +${issues.length - 2} more` : ""}
                  </span>
                </span>
                <ArrowRight className="size-4 text-foreground/25" aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm font-extrabold">No active vehicles</p>
            <p className="mt-1 text-xs text-foreground/48">
              Add a vehicle to begin preparing an advert.
            </p>
          </div>
        )}
      </DataCard>
    </div>
  );
}
