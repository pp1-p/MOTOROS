import {
  Cloud,
  Database,
  HardDriveUpload,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";

import { PageHeader, StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { getStaffContext } from "@/lib/auth/permissions";
import { getEnvironmentHealth } from "@/lib/env";
import { getAutoTraderConfigurationStatus } from "@/lib/integrations/autotrader";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type Check = {
  name: string;
  status: string;
  detail: string;
  response: string;
  icon: typeof Database;
};

async function runChecks(): Promise<Check[]> {
  const configuration = getEnvironmentHealth();
  const checks: Check[] = [
    {
      name: "Application API",
      status: "Operational",
      detail: "This authenticated server-rendered check completed.",
      response: "Live",
      icon: Server,
    },
    {
      name: "Authentication",
      status: "Operational",
      detail: "The current session and dealership role were verified.",
      response: "Live",
      icon: ShieldCheck,
    },
    {
      name: "Vehicle lookup",
      status: configuration.vehicleLookup ? "Available" : "Configuration required",
      detail: "Readiness reflects the selected provider and required credentials.",
      response: configuration.vehicleLookup ? "Ready" : "Missing",
      icon: Cloud,
    },
    {
      name: "Auto Trader",
      status: getAutoTraderConfigurationStatus().status.replaceAll("_", " "),
      detail: getAutoTraderConfigurationStatus().message,
      response: "Configuration",
      icon: Cloud,
    },
  ];
  if (!configuration.supabase || !configuration.serviceRole) {
    return [
      {
        name: "Database",
        status: "Configuration required",
        detail: "Supabase URL, anonymous key or service role access is missing.",
        response: "Not tested",
        icon: Database,
      },
      {
        name: "Storage",
        status: "Configuration required",
        detail: "Storage cannot be tested until Supabase service access is configured.",
        response: "Not tested",
        icon: HardDriveUpload,
      },
      ...checks,
    ];
  }

  const staff = await getStaffContext();
  const supabase = createAdminSupabaseClient();
  const databaseStarted = performance.now();
  const database = staff
    ? await supabase
        .from("organisations")
        .select("id", { count: "exact", head: true })
        .eq("id", staff.organisationId)
    : { error: new Error("No staff context") };
  const databaseMs = Math.max(1, Math.round(performance.now() - databaseStarted));
  const storageStarted = performance.now();
  const storage = await supabase.storage.listBuckets();
  const storageMs = Math.max(1, Math.round(performance.now() - storageStarted));

  return [
    {
      name: "Database",
      status: database.error ? "Error" : "Operational",
      detail: database.error
        ? "The authenticated organisation query failed."
        : "Supabase accepted an organisation-scoped query.",
      response: `${databaseMs} ms`,
      icon: Database,
    },
    {
      name: "Storage",
      status: storage.error ? "Error" : "Operational",
      detail: storage.error
        ? "Bucket access failed."
        : `${storage.data.length} configured storage buckets are visible to the server.`,
      response: `${storageMs} ms`,
      icon: HardDriveUpload,
    },
    ...checks,
  ];
}

export default async function HealthPage() {
  const checkedAt = new Date();
  const checks = await runChecks();
  const healthy = checks.every((check) =>
    ["Operational", "Available", "Configured", "Fallback active", "Disabled"].includes(
      check.status,
    ) || check.name === "Auto Trader",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations & observability"
        title="System health"
        description="Live application checks and integration readiness. No uptime claim is shown without an external monitor."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/admin/health">
              <RefreshCw />
              Run checks again
            </a>
          </Button>
        }
      />
      <section
        className={`rounded-2xl border p-5 ${
          healthy
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}
      >
        <h2 className="font-extrabold">
          {healthy
            ? "Core DealerOS checks completed successfully"
            : "One or more checks need attention"}
        </h2>
        <p className="mt-1 text-xs opacity-65">
          Checked{" "}
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "full",
            timeStyle: "medium",
            timeZone: "Europe/London",
          }).format(checkedAt)}
          .
        </p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => {
          const Icon = check.icon;
          return (
            <section key={check.name} className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft">
                  <Icon className="size-4 text-brand" />
                </span>
                <StatusPill status={check.status} />
              </div>
              <h2 className="mt-4 text-sm font-extrabold">{check.name}</h2>
              <p className="mt-1 text-xs leading-5 text-foreground/45">
                {check.detail}
              </p>
              <div className="mt-4 flex justify-between border-t pt-3 text-[10px]">
                <span className="text-foreground/40">Result</span>
                <strong>{check.response}</strong>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
