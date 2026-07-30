import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type PlatformDealershipSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  memberCount: number;
  vehicleCount: number;
  activeInvoiceCount: number;
  lastActivityAt: string | null;
};

export type PlatformOverview = {
  state: "ready" | "unavailable";
  totals: {
    dealerships: number;
    activeDealerships: number;
    users: number;
    vehiclesInStock: number;
    invoicesLast30Days: number;
    invoicedValueLast30Days: number;
  };
  dealerships: PlatformDealershipSummary[];
};

const empty: PlatformOverview = {
  state: "unavailable",
  totals: {
    dealerships: 0,
    activeDealerships: 0,
    users: 0,
    vehiclesInStock: 0,
    invoicesLast30Days: 0,
    invoicedValueLast30Days: 0,
  },
  dealerships: [],
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  if (!isSupabaseConfigured()) return empty;
  const supabase = createAdminSupabaseClient();
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [orgsResult, membersResult, vehiclesResult, invoicesResult, activityResult] =
    await Promise.all([
      supabase
        .from("organisations")
        .select("id,name,slug,status,created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("organisation_members")
        .select("organisation_id,user_id,is_active"),
      supabase
        .from("vehicles")
        .select("organisation_id,status")
        .is("deleted_at", null),
      supabase
        .from("invoices")
        .select("organisation_id,total,created_at,status")
        .is("deleted_at", null),
      supabase
        .from("audit_logs")
        .select("organisation_id,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(2000),
    ]);

  if (orgsResult.error) return empty;
  const orgs = orgsResult.data ?? [];

  const memberByOrg = new Map<string, Set<string>>();
  for (const row of membersResult.data ?? []) {
    if (!row.is_active) continue;
    const orgId = String(row.organisation_id);
    const userId = String(row.user_id);
    if (!memberByOrg.has(orgId)) memberByOrg.set(orgId, new Set());
    memberByOrg.get(orgId)!.add(userId);
  }

  const vehicleByOrg = new Map<string, number>();
  for (const row of vehiclesResult.data ?? []) {
    if (row.status === "sold") continue;
    const orgId = String(row.organisation_id);
    vehicleByOrg.set(orgId, (vehicleByOrg.get(orgId) ?? 0) + 1);
  }

  const activeInvoiceByOrg = new Map<string, number>();
  let invoicesLast30Days = 0;
  let invoicedValueLast30Days = 0;
  for (const row of invoicesResult.data ?? []) {
    const orgId = String(row.organisation_id);
    if (row.status !== "cancelled" && row.status !== "void") {
      activeInvoiceByOrg.set(
        orgId,
        (activeInvoiceByOrg.get(orgId) ?? 0) + 1,
      );
      if (
        row.created_at &&
        String(row.created_at) >= thirtyDaysAgo
      ) {
        invoicesLast30Days += 1;
        invoicedValueLast30Days += Number(row.total ?? 0);
      }
    }
  }

  const lastActivityByOrg = new Map<string, string>();
  for (const row of activityResult.data ?? []) {
    const orgId = String(row.organisation_id);
    if (!lastActivityByOrg.has(orgId)) {
      lastActivityByOrg.set(orgId, String(row.occurred_at));
    }
  }

  const dealerships: PlatformDealershipSummary[] = orgs.map((org) => ({
    id: String(org.id),
    name: String(org.name),
    slug: String(org.slug),
    status: String(org.status ?? "active"),
    createdAt: String(org.created_at),
    memberCount: memberByOrg.get(String(org.id))?.size ?? 0,
    vehicleCount: vehicleByOrg.get(String(org.id)) ?? 0,
    activeInvoiceCount: activeInvoiceByOrg.get(String(org.id)) ?? 0,
    lastActivityAt: lastActivityByOrg.get(String(org.id)) ?? null,
  }));

  const totalUsers = new Set<string>();
  for (const set of memberByOrg.values()) {
    for (const userId of set) totalUsers.add(userId);
  }

  return {
    state: "ready",
    totals: {
      dealerships: dealerships.length,
      activeDealerships: dealerships.filter((d) => d.status === "active").length,
      users: totalUsers.size,
      vehiclesInStock: Array.from(vehicleByOrg.values()).reduce(
        (sum, n) => sum + n,
        0,
      ),
      invoicesLast30Days,
      invoicedValueLast30Days,
    },
    dealerships,
  };
}

export type PlatformDealershipDetail = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  telephone: string | null;
  email: string | null;
  address: string | null;
  members: {
    userId: string;
    role: string;
    displayName: string | null;
    email: string | null;
    isActive: boolean;
    joinedAt: string | null;
  }[];
  vehicleCount: number;
  vehiclesInStock: number;
  soldLast30Days: number;
  invoiceCount: number;
  outstandingBalance: number;
  invoicedLast30Days: number;
  recentActivity: {
    action: string;
    detail: string | null;
    occurredAt: string;
    actorEmail: string | null;
  }[];
};

export async function getPlatformDealership(
  id: string,
): Promise<PlatformDealershipDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createAdminSupabaseClient();

  const orgResult = await supabase
    .from("organisations")
    .select("id,name,slug,status,created_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (orgResult.error || !orgResult.data) return null;
  const org = orgResult.data;

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    settingsResult,
    membersResult,
    vehiclesResult,
    invoicesResult,
    activityResult,
  ] = await Promise.all([
    supabase
      .from("dealership_settings")
      .select("telephone,email,address")
      .eq("organisation_id", id)
      .maybeSingle(),
    supabase
      .from("organisation_members")
      .select("user_id,role,is_active,joined_at,profiles(display_name,email)")
      .eq("organisation_id", id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("vehicles")
      .select("id,status,sold_at,created_at")
      .eq("organisation_id", id)
      .is("deleted_at", null),
    supabase
      .from("invoices")
      .select("id,total,balance,status,created_at")
      .eq("organisation_id", id)
      .is("deleted_at", null),
    supabase
      .from("audit_logs")
      .select("action,change_reason,occurred_at,actor_user_id,profiles(email)")
      .eq("organisation_id", id)
      .order("occurred_at", { ascending: false })
      .limit(15),
  ]);

  const settings = settingsResult.data ?? null;
  let addressString: string | null = null;
  if (settings && settings.address && typeof settings.address === "object") {
    const address = settings.address as Record<string, unknown>;
    if (typeof address.formatted === "string") {
      addressString = address.formatted;
    } else {
      addressString =
        ["line1", "line2", "town", "county", "postcode", "country"]
          .map((key) => address[key])
          .filter((value): value is string => typeof value === "string")
          .join(", ") || null;
    }
  }

  const members = (membersResult.data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: String(row.user_id),
      role: String(row.role),
      displayName:
        (profile as { display_name?: string } | null)?.display_name ?? null,
      email: (profile as { email?: string } | null)?.email ?? null,
      isActive: Boolean(row.is_active),
      joinedAt: (row.joined_at as string | null) ?? null,
    };
  });

  const vehicles = vehiclesResult.data ?? [];
  const vehiclesInStock = vehicles.filter((v) => v.status !== "sold").length;
  const soldLast30Days = vehicles.filter(
    (v) => v.status === "sold" && v.sold_at && String(v.sold_at) >= thirtyDaysAgo,
  ).length;

  const invoices = invoicesResult.data ?? [];
  const active = invoices.filter(
    (i) => i.status !== "cancelled" && i.status !== "void",
  );
  const outstandingBalance = active.reduce(
    (sum, i) => sum + Number(i.balance ?? 0),
    0,
  );
  const invoicedLast30Days = active.filter(
    (i) => i.created_at && String(i.created_at) >= thirtyDaysAgo,
  ).length;

  const recentActivity = (activityResult.data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      action: String(row.action),
      detail: (row.change_reason as string | null) ?? null,
      occurredAt: String(row.occurred_at),
      actorEmail: (profile as { email?: string } | null)?.email ?? null,
    };
  });

  return {
    id: String(org.id),
    name: String(org.name),
    slug: String(org.slug),
    status: String(org.status ?? "active"),
    createdAt: String(org.created_at),
    telephone: (settings?.telephone as string | null) ?? null,
    email: (settings?.email as string | null) ?? null,
    address: addressString,
    members,
    vehicleCount: vehicles.length,
    vehiclesInStock,
    soldLast30Days,
    invoiceCount: invoices.length,
    outstandingBalance,
    invoicedLast30Days,
    recentActivity,
  };
}

export async function logPlatformAdminAccess(params: {
  organisationId: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
}) {
  if (!isSupabaseConfigured()) return;
  const supabase = createAdminSupabaseClient();
  await supabase.from("audit_logs").insert({
    organisation_id: params.organisationId,
    actor_user_id: params.actorUserId,
    action: params.action,
    entity_type: "organisation",
    entity_id: params.organisationId,
    change_reason: `Platform admin ${params.actorEmail} viewed this dealership`,
    new_values: { source: "platform_admin", actor_email: params.actorEmail },
  });
}
