import "server-only";

import { getPlatformAdmin } from "@/lib/auth/platform-admin";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { socialProviders } from "@/lib/integrations/social-provider";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type PlatformDealershipSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  memberCount: number;
  vehicleCount: number;
  advertisedVehicleCount: number;
  soldVehicleCount: number;
  activeInvoiceCount: number;
  lastActivityAt: string | null;
  telephone: string | null;
  email: string | null;
  location: string | null;
  planCode: string;
  subscriptionStatus: string;
  websiteStatus: string;
  websiteTheme: string;
  integrationProviders: string[];
};

export type PlatformOverview = {
  state: "ready" | "unavailable";
  totals: {
    dealerships: number;
    activeDealerships: number;
    trialDealerships: number;
    suspendedDealerships: number;
    newDealershipsThisMonth: number;
    users: number;
    totalVehicles: number;
    vehiclesInStock: number;
    advertisedVehicles: number;
    totalLeads: number;
    totalSales: number;
    invoicesLast30Days: number;
    invoicedValueLast30Days: number;
    monthlyPlatformRevenue: number;
  };
  dealerships: PlatformDealershipSummary[];
};

const empty: PlatformOverview = {
  state: "unavailable",
  totals: {
    dealerships: 0,
    activeDealerships: 0,
    trialDealerships: 0,
    suspendedDealerships: 0,
    newDealershipsThisMonth: 0,
    users: 0,
    totalVehicles: 0,
    vehiclesInStock: 0,
    advertisedVehicles: 0,
    totalLeads: 0,
    totalSales: 0,
    invoicesLast30Days: 0,
    invoicedValueLast30Days: 0,
    monthlyPlatformRevenue: 0,
  },
  dealerships: [],
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  if (!(await getPlatformAdmin())) return empty;
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return empty;
  }
  const supabase = createAdminSupabaseClient();

  const [
    metricsResult,
    settingsResult,
    subscriptionsResult,
    sitesResult,
    integrationsResult,
  ] = await Promise.all([
      supabase
        .from("platform_dealership_metrics")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("dealership_settings")
        .select("organisation_id,telephone,email,address"),
      supabase
        .from("dealership_subscriptions")
        .select("organisation_id,plan_code,status,monthly_amount_pence"),
      supabase
        .from("dealership_sites")
        .select("organisation_id,status,theme_id"),
      supabase
        .from("integration_settings")
        .select("organisation_id,provider,status"),
    ]);

  if (metricsResult.error) return empty;
  const metrics = metricsResult.data ?? [];

  const settingsByOrg = new Map(
    (settingsResult.data ?? []).map((row) => [String(row.organisation_id), row]),
  );
  const subscriptionByOrg = new Map(
    (subscriptionsResult.data ?? []).map((row) => [
      String(row.organisation_id),
      row,
    ]),
  );
  const siteByOrg = new Map(
    (sitesResult.data ?? []).map((row) => [String(row.organisation_id), row]),
  );
  const integrationsByOrg = new Map<string, string[]>();
  for (const row of integrationsResult.data ?? []) {
    if (row.status !== "connected") continue;
    const orgId = String(row.organisation_id);
    integrationsByOrg.set(orgId, [
      ...(integrationsByOrg.get(orgId) ?? []),
      String(row.provider),
    ]);
  }

  function locationFromAddress(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const address = value as Record<string, unknown>;
    return [address.town, address.county, address.postcode]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(", ") || (typeof address.formatted === "string" ? address.formatted : null);
  }

  const dealerships: PlatformDealershipSummary[] = metrics.map((row) => {
    const orgId = String(row.organisation_id);
    const settings = settingsByOrg.get(orgId);
    const subscription = subscriptionByOrg.get(orgId);
    const site = siteByOrg.get(orgId);
    return {
      id: orgId,
      name: String(row.name),
      slug: String(row.slug),
      status: String(row.status ?? "active"),
      createdAt: String(row.created_at),
      memberCount: Number(row.member_count ?? 0),
      vehicleCount: Number(row.vehicle_count ?? 0),
      advertisedVehicleCount: Number(row.advertised_vehicle_count ?? 0),
      soldVehicleCount: Number(row.sold_vehicle_count ?? 0),
      activeInvoiceCount: Number(row.active_invoice_count ?? 0),
      lastActivityAt: (row.last_activity_at as string | null) ?? null,
      telephone: (settings?.telephone as string | null) ?? null,
      email: (settings?.email as string | null) ?? null,
      location: locationFromAddress(settings?.address),
      planCode: String(subscription?.plan_code ?? "starter"),
      subscriptionStatus: String(subscription?.status ?? "unconfigured"),
      websiteStatus: String(site?.status ?? "unconfigured"),
      websiteTheme: String(site?.theme_id ?? "modern"),
      integrationProviders: integrationsByOrg.get(orgId) ?? [],
    };
  });
  const thisMonth = new Date();
  thisMonth.setUTCDate(1);
  thisMonth.setUTCHours(0, 0, 0, 0);
  const monthlyPlatformRevenue = (subscriptionsResult.data ?? [])
    .filter((row) => ["active", "trialing"].includes(String(row.status)))
    .reduce((sum, row) => sum + Number(row.monthly_amount_pence ?? 0) / 100, 0);

  return {
    state: "ready",
    totals: {
      dealerships: dealerships.length,
      activeDealerships: dealerships.filter((d) => d.status === "active").length,
      trialDealerships: dealerships.filter((d) => d.status === "trial").length,
      suspendedDealerships: dealerships.filter((d) => d.status === "suspended").length,
      newDealershipsThisMonth: dealerships.filter(
        (d) => new Date(d.createdAt) >= thisMonth,
      ).length,
      users: metrics.reduce((sum, row) => sum + Number(row.member_count ?? 0), 0),
      totalVehicles: metrics.reduce((sum, row) => sum + Number(row.vehicle_count ?? 0), 0),
      vehiclesInStock: metrics.reduce((sum, row) => sum + Number(row.vehicles_in_stock ?? 0), 0),
      advertisedVehicles: metrics.reduce((sum, row) => sum + Number(row.advertised_vehicle_count ?? 0), 0),
      totalLeads: metrics.reduce((sum, row) => sum + Number(row.lead_count ?? 0), 0),
      totalSales: metrics.reduce((sum, row) => sum + Number(row.sale_count ?? 0), 0),
      invoicesLast30Days: metrics.reduce((sum, row) => sum + Number(row.invoices_last_30_days ?? 0), 0),
      invoicedValueLast30Days: metrics.reduce(
        (sum, row) => sum + Number(row.invoiced_value_last_30_days ?? 0),
        0,
      ),
      monthlyPlatformRevenue,
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
  leadCount: number;
  saleCount: number;
  subscription: {
    planCode: string;
    status: string;
    trialEndsAt: string | null;
    monthlyAmountPence: number | null;
  } | null;
  website: {
    status: string;
    themeId: string;
    hostedSubdomain: string | null;
    customDomain: string | null;
    customDomainStatus: string | null;
    updatedAt: string;
  } | null;
  integrations: {
    provider: string;
    status: string;
    accountName: string | null;
    lastConnectedAt: string | null;
  }[];
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
  if (!(await getPlatformAdmin())) return null;
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
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
    leadsResult,
    salesResult,
    subscriptionResult,
    siteResult,
    domainsResult,
    integrationsResult,
  ] = await Promise.all([
    supabase
      .from("dealership_settings")
      .select("telephone,email,address")
      .eq("organisation_id", id)
      .maybeSingle(),
    supabase
      .from("organisation_members")
      .select("user_id,role,is_active,joined_at,profiles(display_name)")
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
      .select("action,change_reason,occurred_at,actor_user_id")
      .eq("organisation_id", id)
      .order("occurred_at", { ascending: false })
      .limit(15),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", id)
      .is("deleted_at", null),
    supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", id)
      .is("deleted_at", null),
    supabase
      .from("dealership_subscriptions")
      .select("plan_code,status,trial_ends_at,monthly_amount_pence")
      .eq("organisation_id", id)
      .maybeSingle(),
    supabase
      .from("dealership_sites")
      .select("status,theme_id,hosted_subdomain,updated_at")
      .eq("organisation_id", id)
      .maybeSingle(),
    supabase
      .from("dealership_domains")
      .select("hostname,status")
      .eq("organisation_id", id)
      .eq("domain_type", "custom")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("integration_settings")
      .select("provider,status,account_name,last_connected_at")
      .eq("organisation_id", id)
      .order("provider", { ascending: true }),
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

  const actorIds = new Set<string>();
  for (const row of membersResult.data ?? []) actorIds.add(String(row.user_id));
  for (const row of activityResult.data ?? []) {
    if (row.actor_user_id) actorIds.add(String(row.actor_user_id));
  }
  const actorEmails = new Map<string, string>();
  await Promise.all(
    Array.from(actorIds).map(async (userId) => {
      const result = await supabase.auth.admin.getUserById(userId);
      if (result.data.user?.email) {
        actorEmails.set(userId, result.data.user.email);
      }
    }),
  );

  const members = (membersResult.data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: String(row.user_id),
      role: String(row.role),
      displayName:
        (profile as { display_name?: string } | null)?.display_name ?? null,
      email: actorEmails.get(String(row.user_id)) ?? null,
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
    return {
      action: String(row.action),
      detail: (row.change_reason as string | null) ?? null,
      occurredAt: String(row.occurred_at),
      actorEmail: row.actor_user_id
        ? actorEmails.get(String(row.actor_user_id)) ?? null
        : null,
    };
  });

  const subscription = subscriptionResult.data
    ? {
        planCode: String(subscriptionResult.data.plan_code),
        status: String(subscriptionResult.data.status),
        trialEndsAt:
          (subscriptionResult.data.trial_ends_at as string | null) ?? null,
        monthlyAmountPence:
          subscriptionResult.data.monthly_amount_pence === null
            ? null
            : Number(subscriptionResult.data.monthly_amount_pence),
      }
    : null;
  const site = siteResult.data;
  const customDomain = domainsResult.data;
  const website = site
    ? {
        status: String(site.status),
        themeId: String(site.theme_id),
        hostedSubdomain: (site.hosted_subdomain as string | null) ?? null,
        customDomain: (customDomain?.hostname as string | null) ?? null,
        customDomainStatus: (customDomain?.status as string | null) ?? null,
        updatedAt: String(site.updated_at),
      }
    : null;
  const integrations = (integrationsResult.data ?? []).map((row) => ({
    provider: String(row.provider),
    status: String(row.status),
    accountName: (row.account_name as string | null) ?? null,
    lastConnectedAt: (row.last_connected_at as string | null) ?? null,
  }));

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
    leadCount: leadsResult.count ?? 0,
    saleCount: salesResult.count ?? 0,
    subscription,
    website,
    integrations,
    recentActivity,
  };
}

export async function logPlatformAdminAccess(params: {
  organisationId: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
}) {
  const admin = await getPlatformAdmin();
  if (!admin || admin.userId !== params.actorUserId) return;
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) return;
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

export type PlatformIntegrationHealth = {
  provider: string;
  name: string;
  connected: number;
  actionRequired: number;
  errors: number;
  configured: number;
};

export async function getPlatformIntegrationHealth(): Promise<
  PlatformIntegrationHealth[]
> {
  if (!(await getPlatformAdmin())) return [];
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }
  const result = await createAdminSupabaseClient()
    .from("integration_settings")
    .select("provider,status");
  const rows = result.data ?? [];
  const known = socialProviders.map((provider) => ({
    provider: provider.id,
    name: provider.name,
  }));
  const extraProviders = Array.from(
    new Set(rows.map((row) => String(row.provider))),
  )
    .filter((provider) => !known.some((item) => item.provider === provider))
    .map((provider) => ({
      provider,
      name: provider.replaceAll("_", " "),
    }));

  return [...known, ...extraProviders].map((provider) => {
    const providerRows = rows.filter((row) => row.provider === provider.provider);
    return {
      ...provider,
      connected: providerRows.filter((row) => row.status === "connected").length,
      actionRequired: providerRows.filter((row) =>
        ["token_expired", "action_required", "permission_missing"].includes(
          String(row.status),
        ),
      ).length,
      errors: providerRows.filter((row) =>
        ["error", "authentication_failed"].includes(String(row.status)),
      ).length,
      configured: providerRows.filter((row) => row.status !== "not_configured")
        .length,
    };
  });
}

export type PlatformWebsiteSummary = {
  organisationId: string;
  dealershipName: string;
  organisationStatus: string;
  siteStatus: string;
  themeId: string;
  hostedSubdomain: string | null;
  customDomain: string | null;
  customDomainStatus: string | null;
  lastDeploymentAt: string | null;
  updatedAt: string;
};

export async function getPlatformWebsites(): Promise<PlatformWebsiteSummary[]> {
  if (!(await getPlatformAdmin())) return [];
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }
  const supabase = createAdminSupabaseClient();
  const [organisations, sites, domains] = await Promise.all([
    supabase
      .from("organisations")
      .select("id,name,status")
      .is("deleted_at", null),
    supabase
      .from("dealership_sites")
      .select(
        "organisation_id,status,theme_id,hosted_subdomain,last_deployment_at,updated_at",
      ),
    supabase
      .from("dealership_domains")
      .select("organisation_id,hostname,status,domain_type")
      .eq("domain_type", "custom"),
  ]);
  const organisationById = new Map(
    (organisations.data ?? []).map((row) => [String(row.id), row]),
  );
  const customDomainByOrg = new Map(
    (domains.data ?? []).map((row) => [String(row.organisation_id), row]),
  );
  return (sites.data ?? []).map((site) => {
    const organisation = organisationById.get(String(site.organisation_id));
    const customDomain = customDomainByOrg.get(String(site.organisation_id));
    return {
      organisationId: String(site.organisation_id),
      dealershipName: String(organisation?.name ?? "Unknown dealership"),
      organisationStatus: String(organisation?.status ?? "unknown"),
      siteStatus: String(site.status),
      themeId: String(site.theme_id),
      hostedSubdomain: (site.hosted_subdomain as string | null) ?? null,
      customDomain: (customDomain?.hostname as string | null) ?? null,
      customDomainStatus: (customDomain?.status as string | null) ?? null,
      lastDeploymentAt: (site.last_deployment_at as string | null) ?? null,
      updatedAt: String(site.updated_at),
    };
  });
}
