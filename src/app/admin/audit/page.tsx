import Link from "next/link";
import { Download, Search, ShieldCheck } from "lucide-react";

import { PageHeader, StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStaffContext } from "@/lib/auth/permissions";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AuditEvent = {
  id: string;
  time: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: string;
  source: string;
};

async function loadAuditEvents(): Promise<AuditEvent[]> {
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }
  const staff = await getStaffContext();
  if (!staff) return [];
  const supabase = createAdminSupabaseClient();
  const events = await supabase
    .from("audit_logs")
    .select(
      "id,created_at,actor_user_id,action,entity_type,entity_id,change_reason,source",
    )
    .eq("organisation_id", staff.organisationId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (events.error) {
    throw new Error(`Audit events could not be loaded: ${events.error.message}`);
  }
  const actorIds = [
    ...new Set(
      (events.data ?? [])
        .map((event) => event.actor_user_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const profiles = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id,display_name,full_name")
        .in("id", actorIds)
    : { data: [], error: null };
  const names = new Map(
    (profiles.data ?? []).map((profile) => [
      profile.id,
      profile.display_name ?? profile.full_name ?? "Team member",
    ]),
  );
  return (events.data ?? []).map((event) => ({
    id: event.id,
    time: event.created_at,
    actor: event.actor_user_id
      ? names.get(event.actor_user_id) ?? "Team member"
      : "System",
    action: String(event.action).replaceAll(".", " ").replaceAll("_", " "),
    entityType: String(event.entity_type ?? "record").replaceAll("_", " "),
    entityId: event.entity_id,
    detail: event.change_reason ?? "Recorded by DealerOS",
    source: event.source ?? "application",
  }));
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const { query = "" } = await searchParams;
  const events = await loadAuditEvents();
  const normalised = query.trim().toLowerCase();
  const visible = normalised
    ? events.filter((event) =>
        `${event.actor} ${event.action} ${event.entityType} ${event.entityId ?? ""}`
          .toLowerCase()
          .includes(normalised),
      )
    : events;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Immutable activity"
        title="Audit log"
        description="Permission-checked history for security-sensitive and operational changes."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/audit/export" download>
              <Download />
              Export audit CSV
            </a>
          </Button>
        }
      />
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
        <ShieldCheck className="size-4 shrink-0" />
        <p className="text-xs leading-5">
          Audit events cannot be edited from DealerOS. Exports include only records your role may view.
        </p>
      </div>
      <form
        action="/admin/audit"
        className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
          <Input
            name="query"
            defaultValue={query}
            placeholder="Search actor, action or entity reference…"
            className="h-10 border-0 bg-surface-muted pl-9 shadow-none"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Search events
        </Button>
      </form>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left">
            <thead className="border-b bg-[#fafaf8] text-[10px] font-extrabold uppercase tracking-wider text-foreground/38">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((event) => (
                <tr key={event.id} className="hover:bg-[#fafaf8]">
                  <td className="px-4 py-3 font-mono text-[10px] font-bold text-foreground/48">
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "short",
                      timeStyle: "medium",
                      timeZone: "Europe/London",
                    }).format(new Date(event.time))}
                  </td>
                  <td className="px-4 py-3 text-xs font-extrabold">{event.actor}</td>
                  <td className="px-4 py-3 text-xs font-bold">{event.action}</td>
                  <td className="px-4 py-3">
                    {event.entityId ? (
                      <Link
                        href={`/admin/search?q=${encodeURIComponent(event.entityId)}`}
                        className="text-xs font-extrabold text-brand hover:underline"
                      >
                        {event.entityType}
                      </Link>
                    ) : (
                      <span className="text-xs text-foreground/45">{event.entityType}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground/50">{event.detail}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={event.source} />
                  </td>
                </tr>
              ))}
              {!visible.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-xs text-foreground/45">
                    No audit events match this search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
