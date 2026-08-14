import { Cable, CheckCircle2, CircleAlert, LockKeyhole } from "lucide-react";

import { Notice, PageHeader, StatusPill } from "@/components/admin/page-kit";
import { SocialNav } from "@/components/admin/social-nav";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/permissions";
import { getSocialConnections } from "@/lib/data/social-hub";
import { getTenantEntitlements } from "@/lib/data/tenant-entitlements";

export default async function SocialConnectionsPage() {
  const staff = await requireStaff("social:view");
  const [connections, entitlements] = await Promise.all([
    getSocialConnections(staff.organisationId),
    getTenantEntitlements(staff.organisationId),
  ]);
  const enabled = entitlements.features["social.connections"];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Social hub"
        title="Connections"
        description="Provider status, granted capabilities and deployment readiness—without exposing tokens or secret values."
      />
      <SocialNav />
      {!enabled ? (
        <Notice title="Connections are not enabled for this plan">
          The provider catalogue remains visible so the dealership can evaluate channel
          support. A Professional or Premium entitlement is required to connect accounts.
        </Notice>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {connections.map((connection) => (
          <section key={connection.provider} className="rounded-2xl border bg-white p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft">
                <Cable className="size-5 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-extrabold">{connection.name}</h2>
                  <StatusPill status={connection.statusLabel} />
                </div>
                <p className="mt-1 text-xs leading-5 text-foreground/50">
                  {connection.description}
                </p>
              </div>
            </div>

            {connection.accountName || connection.accountUsername ? (
              <p className="mt-4 rounded-xl bg-surface-muted p-3 text-xs font-bold">
                {connection.accountName ?? connection.accountUsername}
                {connection.accountName && connection.accountUsername
                  ? ` · ${connection.accountUsername}`
                  : ""}
              </p>
            ) : null}

            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold">
              {connection.deploymentConfigured ? (
                <CheckCircle2 className="size-3.5 text-emerald-600" />
              ) : (
                <CircleAlert className="size-3.5 text-amber-600" />
              )}
              {connection.deploymentConfigured
                ? "Required server configuration is present"
                : "Requires API configuration in the deployment environment"}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-foreground/45">
              {connection.setupNote}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {connection.capabilities.map((capability) => (
                <span
                  key={capability}
                  className="rounded-full bg-surface-muted px-2 py-1 text-[9px] font-extrabold text-foreground/55"
                >
                  {capability.replaceAll("_", " ")}
                </span>
              ))}
            </div>
            {connection.lastErrorMessage ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[10px] leading-4 text-red-900">
                {connection.lastErrorMessage}
              </p>
            ) : null}
            {connection.status === "connected" ? (
              <p className="mt-4 text-[10px] font-bold text-emerald-700">
                Connected {connection.lastConnectedAt ? new Date(connection.lastConnectedAt).toLocaleString("en-GB") : ""}
              </p>
            ) : (
              <Button className="mt-4" disabled size="sm" variant="outline">
                <LockKeyhole />
                {enabled ? "Provider adapter required" : "Plan upgrade required"}
              </Button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
