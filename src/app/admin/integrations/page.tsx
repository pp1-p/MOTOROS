import {
  CarFront,
  CheckCircle2,
  Cloud,
  Mail,
  MessageSquareText,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { Notice, PageHeader, StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { getStaffContext } from "@/lib/auth/permissions";
import {
  getEnvironmentHealth,
  getServerEnv,
  isSupabaseConfigured,
} from "@/lib/env";
import { getAutoTraderConfigurationStatus } from "@/lib/integrations/autotrader";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type IntegrationEvent = {
  id: string;
  title: string;
  detail: string;
  time: string;
  failed: boolean;
};

async function loadIntegrationEvents(): Promise<IntegrationEvent[]> {
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }
  const staff = await getStaffContext();
  if (!staff) return [];
  const rows = await createAdminSupabaseClient()
    .from("vehicle_sync_records")
    .select("id,provider,status,error_message,updated_at,completed_at")
    .eq("organisation_id", staff.organisationId)
    .order("updated_at", { ascending: false })
    .limit(10);
  if (rows.error) return [];
  return (rows.data ?? []).map((row) => ({
    id: row.id,
    title: `${String(row.provider).replaceAll("_", " ")} sync ${row.status}`,
    detail: row.error_message ?? "Provider response recorded without an error.",
    time: row.completed_at ?? row.updated_at,
    failed: ["failed", "error"].includes(row.status),
  }));
}

export default async function IntegrationsPage() {
  const env = getServerEnv();
  const health = getEnvironmentHealth();
  const autoTrader = getAutoTraderConfigurationStatus();
  const events = await loadIntegrationEvents();
  const cards = [
    {
      icon: CarFront,
      name: "Vehicle lookup",
      provider: env.VEHICLE_LOOKUP_PROVIDER.toUpperCase(),
      status: health.vehicleLookup ? "Available" : "Configuration required",
      detail:
        env.VEHICLE_LOOKUP_PROVIDER === "mock"
          ? "Explicit development fixtures are active. Unknown registrations fall back to manual entry."
          : health.vehicleLookup
            ? "The selected server-side provider has the required configuration. Staff still review every returned field."
            : "Add the provider credentials or use manual registration entry.",
    },
    {
      icon: Cloud,
      name: "Auto Trader Connect",
      provider: "Stock & Deal Sync",
      status: autoTrader.status.replaceAll("_", " "),
      detail: autoTrader.message,
    },
    {
      icon: Mail,
      name: "Customer email",
      provider: env.EMAIL_PROVIDER === "resend" ? "Resend" : "Console fallback",
      status:
        env.EMAIL_PROVIDER === "resend" && health.email
          ? "Configured"
          : "Fallback active",
      detail:
        env.EMAIL_PROVIDER === "resend"
          ? "Credentials are present. Verify delivery, bounce handling and the sending domain before launch."
          : "Email events are recorded safely while in-app confirmations remain the reliable fallback.",
    },
    {
      icon: MessageSquareText,
      name: "SMS messaging",
      provider: "No delivery adapter",
      status: "Not implemented",
      detail:
        "No SMS is sent in this release. Core workflows use in-app records and optional email; add and test an approved provider before offering SMS reminders.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Connected services"
        title="Integrations"
        description="Live configuration state and recent sync outcomes. A provider is never labelled connected from credentials alone."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/admin/integrations">
              <RefreshCw />
              Refresh status
            </a>
          </Button>
        }
      />
      <Notice title="Credentials stay server-side" tone="info">
        Provider secrets are protected environment variables. They are never returned to the browser
        or written into logs. Change configuration through the deployment environment, then refresh.
      </Notice>
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((integration) => {
          const Icon = integration.icon;
          return (
            <section key={integration.name} className="rounded-2xl border bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft">
                  <Icon className="size-5 text-brand" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-extrabold">{integration.name}</h2>
                    <StatusPill status={integration.status} />
                  </div>
                  <p className="mt-1 text-[10px] font-bold text-foreground/38">
                    {integration.provider}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-foreground/48">
                {integration.detail}
              </p>
            </section>
          );
        })}
      </div>

      <section className="rounded-2xl border bg-white">
        <div className="border-b p-5">
          <h2 className="font-extrabold">Recent integration events</h2>
        </div>
        <div className="divide-y">
          {events.map((event) => {
            const Icon = event.failed ? TriangleAlert : CheckCircle2;
            return (
              <div key={event.id} className="flex items-center gap-3 p-4">
                <Icon
                  className={`size-4 shrink-0 ${
                    event.failed ? "text-amber-600" : "text-emerald-600"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold">{event.title}</p>
                  <p className="mt-0.5 truncate text-[10px] text-foreground/42">
                    {event.detail}
                  </p>
                </div>
                <time className="text-[10px] font-bold text-foreground/35">
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "Europe/London",
                  }).format(new Date(event.time))}
                </time>
              </div>
            );
          })}
          {!events.length ? (
            <p className="p-5 text-xs text-foreground/45">
              No provider sync has been attempted for this dealership.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
