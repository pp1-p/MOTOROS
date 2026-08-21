import "server-only";

import type { PlatformAdminContext } from "@/lib/auth/platform-admin";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { THEME_IDS, type ThemeId } from "@/lib/themes";

export const platformDealershipStatuses = [
  "trial",
  "active",
  "suspended",
  "cancelled",
  "closed",
] as const;
export type PlatformDealershipStatus =
  (typeof platformDealershipStatuses)[number];

export const platformWebsiteStatuses = [
  "draft",
  "published",
  "unpublished",
] as const;
export type PlatformWebsiteStatus = (typeof platformWebsiteStatuses)[number];

export const platformDomainStatuses = [
  "pending",
  "verified",
  "failed",
  "disabled",
] as const;
export type PlatformDomainStatus = (typeof platformDomainStatuses)[number];

export const platformThemeIds = THEME_IDS;
export type PlatformThemeId = ThemeId;

export type PlatformDirectorySort =
  | "created"
  | "name"
  | "activity"
  | "vehicles"
  | "leads";

export type PlatformDirectoryQuery = {
  q: string;
  status: PlatformDealershipStatus | "all";
  websiteStatus: PlatformWebsiteStatus | "all";
  themeId: PlatformThemeId | "all";
  sort: PlatformDirectorySort;
  direction: "asc" | "desc";
  page: number;
  pageSize: 10 | 25 | 50;
};

type SearchValue = string | string[] | undefined;

function firstSearchValue(value: SearchValue): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function clampInteger(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback;
}

export function normalisePlatformDirectoryQuery(
  input: Record<string, SearchValue> = {},
): PlatformDirectoryQuery {
  const status = firstSearchValue(input.status);
  const websiteStatus = firstSearchValue(input.websiteStatus);
  const themeId = firstSearchValue(input.themeId);
  const sort = firstSearchValue(input.sort);
  const requestedPageSize = clampInteger(
    firstSearchValue(input.pageSize),
    25,
    10,
    50,
  );
  const pageSize = ([10, 25, 50] as const).find(
    (size) => size === requestedPageSize,
  ) ?? 25;

  return {
    q: firstSearchValue(input.q).trim().slice(0, 100),
    status: platformDealershipStatuses.includes(
      status as PlatformDealershipStatus,
    )
      ? (status as PlatformDealershipStatus)
      : "all",
    websiteStatus: platformWebsiteStatuses.includes(
      websiteStatus as PlatformWebsiteStatus,
    )
      ? (websiteStatus as PlatformWebsiteStatus)
      : "all",
    themeId: platformThemeIds.includes(themeId as PlatformThemeId)
      ? (themeId as PlatformThemeId)
      : "all",
    sort: ["created", "name", "activity", "vehicles", "leads"].includes(
      sort,
    )
      ? (sort as PlatformDirectorySort)
      : "created",
    direction: firstSearchValue(input.direction) === "asc" ? "asc" : "desc",
    page: clampInteger(firstSearchValue(input.page), 1, 1, 10_000),
    pageSize,
  };
}

export type PlatformDealershipSummary = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  status: PlatformDealershipStatus;
  planCode: string;
  websiteStatus: PlatformWebsiteStatus;
  publishedThemeId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  customDomain: string | null;
  customDomainStatus: PlatformDomainStatus | null;
  createdAt: string;
  lastActivityAt: string | null;
  staffCount: number;
  vehicleCount: number;
  leadCount: number;
};

export function applyPlatformDirectoryQuery(
  dealerships: PlatformDealershipSummary[],
  query: PlatformDirectoryQuery,
): {
  rows: PlatformDealershipSummary[];
  totalMatches: number;
  totalPages: number;
  page: number;
} {
  const needle = query.q.toLowerCase();
  const filtered = dealerships.filter((dealership) => {
    if (query.status !== "all" && dealership.status !== query.status) {
      return false;
    }
    if (
      query.websiteStatus !== "all" &&
      dealership.websiteStatus !== query.websiteStatus
    ) {
      return false;
    }
    if (
      query.themeId !== "all" &&
      dealership.publishedThemeId !== query.themeId
    ) {
      return false;
    }
    if (!needle) return true;
    return [
      dealership.name,
      dealership.slug,
      dealership.subdomain,
      dealership.customDomain,
      dealership.ownerName,
      dealership.ownerEmail,
    ].some((value) => value?.toLowerCase().includes(needle));
  });

  const direction = query.direction === "asc" ? 1 : -1;
  const valueFor = (row: PlatformDealershipSummary): string | number => {
    switch (query.sort) {
      case "name":
        return row.name.toLowerCase();
      case "activity":
        return row.lastActivityAt ? new Date(row.lastActivityAt).getTime() : 0;
      case "vehicles":
        return row.vehicleCount;
      case "leads":
        return row.leadCount;
      default:
        return new Date(row.createdAt).getTime();
    }
  };

  filtered.sort((left, right) => {
    const a = valueFor(left);
    const b = valueFor(right);
    const compared =
      typeof a === "string" && typeof b === "string"
        ? a.localeCompare(b, "en-GB")
        : Number(a) - Number(b);
    return compared === 0
      ? left.name.localeCompare(right.name, "en-GB")
      : compared * direction;
  });

  const totalMatches = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const offset = (page - 1) * query.pageSize;
  return {
    rows: filtered.slice(offset, offset + query.pageSize),
    totalMatches,
    totalPages,
    page,
  };
}

export type PlatformActivity = {
  organisationId: string;
  organisationName: string;
  action: string;
  detail: string | null;
  occurredAt: string;
  actorEmail: string | null;
};

export type PlatformOverview = {
  state: "ready" | "unavailable";
  message?: string;
  totals: {
    dealerships: number;
    trialDealerships: number;
    activeDealerships: number;
    suspendedDealerships: number;
    cancelledDealerships: number;
    publishedWebsites: number;
    unpublishedWebsites: number;
    users: number;
    vehicles: number;
    leads: number;
  };
  query: PlatformDirectoryQuery;
  dealerships: PlatformDealershipSummary[];
  totalMatches: number;
  totalPages: number;
  page: number;
  recentDealerships: PlatformDealershipSummary[];
  recentActivity: PlatformActivity[];
};

function unavailableOverview(
  query: PlatformDirectoryQuery,
  message: string,
): PlatformOverview {
  return {
    state: "unavailable",
    message,
    totals: {
      dealerships: 0,
      trialDealerships: 0,
      activeDealerships: 0,
      suspendedDealerships: 0,
      cancelledDealerships: 0,
      publishedWebsites: 0,
      unpublishedWebsites: 0,
      users: 0,
      vehicles: 0,
      leads: 0,
    },
    query,
    dealerships: [],
    totalMatches: 0,
    totalPages: 1,
    page: 1,
    recentDealerships: [],
    recentActivity: [],
  };
}

type MemberDirectoryRow = {
  organisation_id: string;
  user_id: string;
  role: string;
  status: string;
  profiles:
    | { display_name?: string | null }
    | { display_name?: string | null }[]
    | null;
};

function profileFor(row: MemberDirectoryRow) {
  return Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
}

export async function getPlatformOverview(
  input: Record<string, SearchValue> = {},
): Promise<PlatformOverview> {
  const query = normalisePlatformDirectoryQuery(input);
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return unavailableOverview(query, "Supabase service access is unavailable.");
  }

  const supabase = createAdminSupabaseClient();
  const [
    organisationsResult,
    settingsResult,
    domainsResult,
    membersResult,
    vehiclesResult,
    leadsResult,
    activityResult,
    authUsersResult,
  ] = await Promise.all([
    supabase
      .from("organisations")
      .select(
        "id,name,slug,subdomain,status,plan_code,website_status,created_at",
      )
      .is("deleted_at", null),
    supabase
      .from("dealership_settings")
      .select("organisation_id,published_theme_id,draft_theme_id"),
    supabase.from("dealership_domains").select("*"),
    supabase
      .from("organisation_members")
      .select(
        "organisation_id,user_id,role,status,profiles(display_name)",
      )
      .is("deleted_at", null),
    supabase
      .from("vehicles")
      .select("id,organisation_id")
      .is("deleted_at", null),
    supabase
      .from("leads")
      .select("id,organisation_id")
      .is("deleted_at", null),
    supabase
      .from("audit_logs")
      .select(
        "organisation_id,actor_user_id,action,change_reason,occurred_at",
      )
      .order("occurred_at", { ascending: false })
      .limit(2_000),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1_000 }),
  ]);

  const failed = [
    ["organisations", organisationsResult.error],
    ["dealership settings", settingsResult.error],
    ["domains", domainsResult.error],
    ["memberships", membersResult.error],
    ["vehicles", vehiclesResult.error],
    ["leads", leadsResult.error],
    ["activity", activityResult.error],
    ["Auth directory", authUsersResult.error],
  ].find(([, error]) => Boolean(error));
  if (failed) {
    return unavailableOverview(
      query,
      `Platform ${String(failed[0])} data could not be loaded.`,
    );
  }

  const organisations = organisationsResult.data ?? [];
  const authDirectory = new Map(
    (authUsersResult.data?.users ?? []).map((user) => [
      user.id,
      {
        email: user.email ?? null,
        displayName:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null,
      },
    ]),
  );
  const organisationNames = new Map(
    organisations.map((row) => [String(row.id), String(row.name)]),
  );
  const settingsByOrganisation = new Map(
    (settingsResult.data ?? []).map((row) => [String(row.organisation_id), row]),
  );
  const domainsByOrganisation = new Map<string, Record<string, unknown>[]>();
  for (const row of domainsResult.data ?? []) {
    const organisationId = String(row.organisation_id);
    const existing = domainsByOrganisation.get(organisationId) ?? [];
    existing.push(row);
    domainsByOrganisation.set(organisationId, existing);
  }

  const membersByOrganisation = new Map<string, MemberDirectoryRow[]>();
  for (const rawRow of membersResult.data ?? []) {
    const row = rawRow as unknown as MemberDirectoryRow;
    if (row.status !== "active") continue;
    const organisationId = String(row.organisation_id);
    const existing = membersByOrganisation.get(organisationId) ?? [];
    existing.push(row);
    membersByOrganisation.set(organisationId, existing);
  }

  const vehicleCount = new Map<string, number>();
  for (const row of vehiclesResult.data ?? []) {
    const organisationId = String(row.organisation_id);
    vehicleCount.set(
      organisationId,
      (vehicleCount.get(organisationId) ?? 0) + 1,
    );
  }
  const leadCount = new Map<string, number>();
  for (const row of leadsResult.data ?? []) {
    const organisationId = String(row.organisation_id);
    leadCount.set(organisationId, (leadCount.get(organisationId) ?? 0) + 1);
  }

  const lastActivity = new Map<string, string>();
  const recentActivity: PlatformActivity[] = [];
  for (const rawRow of activityResult.data ?? []) {
    const row = rawRow as unknown as {
      organisation_id: string;
      action: string;
      change_reason: string | null;
      occurred_at: string;
      actor_user_id: string | null;
    };
    const organisationId = String(row.organisation_id);
    if (!lastActivity.has(organisationId)) {
      lastActivity.set(organisationId, String(row.occurred_at));
    }
    if (recentActivity.length < 12 && organisationNames.has(organisationId)) {
      recentActivity.push({
        organisationId,
        organisationName: organisationNames.get(organisationId) ?? "Dealership",
        action: String(row.action),
        detail: row.change_reason,
        occurredAt: String(row.occurred_at),
        actorEmail: row.actor_user_id
          ? (authDirectory.get(row.actor_user_id)?.email ?? null)
          : null,
      });
    }
  }

  const dealerships: PlatformDealershipSummary[] = organisations.map((row) => {
    const organisationId = String(row.id);
    const settings = settingsByOrganisation.get(organisationId);
    const members = membersByOrganisation.get(organisationId) ?? [];
    const owner = members.find((member) => member.role === "owner");
    const ownerProfile = owner ? profileFor(owner) : null;
    const customDomains = (domainsByOrganisation.get(organisationId) ?? [])
      .filter((domain) => domain.type === "custom")
      .sort((left, right) => {
        const leftVerified = left.status === "verified" ? 1 : 0;
        const rightVerified = right.status === "verified" ? 1 : 0;
        return rightVerified - leftVerified;
      });
    const customDomain = customDomains[0];
    return {
      id: organisationId,
      name: String(row.name),
      slug: String(row.slug),
      subdomain: String(row.subdomain),
      status: String(row.status) as PlatformDealershipStatus,
      planCode: String(row.plan_code),
      websiteStatus: String(row.website_status) as PlatformWebsiteStatus,
      publishedThemeId: String(
        settings?.published_theme_id ?? "direct-motors-classic",
      ),
      ownerName:
        ownerProfile?.display_name ??
        (owner ? authDirectory.get(owner.user_id)?.displayName : null) ??
        null,
      ownerEmail: owner
        ? (authDirectory.get(owner.user_id)?.email ?? null)
        : null,
      customDomain: customDomain ? String(customDomain.hostname) : null,
      customDomainStatus: customDomain
        ? (String(customDomain.status) as PlatformDomainStatus)
        : null,
      createdAt: String(row.created_at),
      lastActivityAt: lastActivity.get(organisationId) ?? null,
      staffCount: new Set(members.map((member) => member.user_id)).size,
      vehicleCount: vehicleCount.get(organisationId) ?? 0,
      leadCount: leadCount.get(organisationId) ?? 0,
    };
  });

  const directory = applyPlatformDirectoryQuery(dealerships, query);
  const users = new Set<string>();
  for (const members of membersByOrganisation.values()) {
    for (const member of members) users.add(member.user_id);
  }

  return {
    state: "ready",
    totals: {
      dealerships: dealerships.length,
      trialDealerships: dealerships.filter((row) => row.status === "trial")
        .length,
      activeDealerships: dealerships.filter((row) => row.status === "active")
        .length,
      suspendedDealerships: dealerships.filter(
        (row) => row.status === "suspended",
      ).length,
      cancelledDealerships: dealerships.filter(
        (row) => row.status === "cancelled",
      ).length,
      publishedWebsites: dealerships.filter(
        (row) => row.websiteStatus === "published",
      ).length,
      unpublishedWebsites: dealerships.filter(
        (row) => row.websiteStatus !== "published",
      ).length,
      users: users.size,
      vehicles: vehiclesResult.data?.length ?? 0,
      leads: leadsResult.data?.length ?? 0,
    },
    query,
    dealerships: directory.rows,
    totalMatches: directory.totalMatches,
    totalPages: directory.totalPages,
    page: directory.page,
    recentDealerships: [...dealerships]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )
      .slice(0, 5),
    recentActivity,
  };
}

export type PlatformDealershipDetail = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  status: PlatformDealershipStatus;
  planCode: string;
  websiteStatus: PlatformWebsiteStatus;
  onboardingStep: string;
  onboardingCompletedAt: string | null;
  suspendedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  contact: {
    telephone: string | null;
    email: string | null;
    address: string | null;
  };
  branding: {
    publishedThemeId: string;
    draftThemeId: string;
    fontPreset: string;
    themeSettings: Record<string, unknown>;
  };
  domains: {
    id: string;
    hostname: string;
    type: "subdomain" | "custom";
    status: PlatformDomainStatus;
    verifiedAt: string | null;
    createdAt: string;
  }[];
  members: {
    userId: string;
    role: string;
    displayName: string | null;
    email: string | null;
    status: string;
    joinedAt: string | null;
  }[];
  inventory: { total: number; inStock: number; sold: number };
  leads: { total: number; open: number; won: number; lost: number };
  invoices: { total: number; outstandingBalance: number };
  websitePages: { total: number; published: number };
  themePublications: {
    id: string;
    themeId: string;
    previousThemeId: string | null;
    publishedAt: string;
  }[];
  recentActivity: PlatformActivity[];
};

function formattedAddress(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const address = value as Record<string, unknown>;
  if (typeof address.formatted === "string") return address.formatted;
  return (
    ["line1", "line2", "town", "county", "postcode", "country"]
      .map((key) => address[key])
      .filter((part): part is string => typeof part === "string" && part !== "")
      .join(", ") || null
  );
}

export async function getPlatformDealership(
  id: string,
): Promise<PlatformDealershipDetail | null> {
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const supabase = createAdminSupabaseClient();
  const organisationResult = await supabase
    .from("organisations")
    .select(
      "id,name,slug,subdomain,status,plan_code,website_status,onboarding_step,onboarding_completed_at,suspended_at,cancelled_at,created_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (organisationResult.error || !organisationResult.data) return null;

  const [
    settingsResult,
    domainsResult,
    membersResult,
    vehiclesResult,
    leadsResult,
    invoicesResult,
    pagesResult,
    publicationsResult,
    activityResult,
    authUsersResult,
  ] = await Promise.all([
    supabase
      .from("dealership_settings")
      .select("*")
      .eq("organisation_id", id)
      .single(),
    supabase
      .from("dealership_domains")
      .select("*")
      .eq("organisation_id", id)
      .order("type", { ascending: false }),
    supabase
      .from("organisation_members")
      .select("user_id,role,status,joined_at,profiles(display_name)")
      .eq("organisation_id", id)
      .is("deleted_at", null)
      .order("joined_at", { ascending: true }),
    supabase
      .from("vehicles")
      .select("id,status")
      .eq("organisation_id", id)
      .is("deleted_at", null),
    supabase
      .from("leads")
      .select("id,status")
      .eq("organisation_id", id)
      .is("deleted_at", null),
    supabase
      .from("invoices")
      .select("id,status,balance")
      .eq("organisation_id", id)
      .is("deleted_at", null),
    supabase
      .from("website_pages")
      .select("id,status")
      .eq("organisation_id", id)
      .is("deleted_at", null),
    supabase
      .from("website_theme_publications")
      .select("id,theme_id,previous_theme_id,published_at")
      .eq("organisation_id", id)
      .order("published_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_logs")
      .select("actor_user_id,action,change_reason,occurred_at")
      .eq("organisation_id", id)
      .order("occurred_at", { ascending: false })
      .limit(30),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1_000 }),
  ]);

  const failed = [
    settingsResult.error,
    domainsResult.error,
    membersResult.error,
    vehiclesResult.error,
    leadsResult.error,
    invoicesResult.error,
    pagesResult.error,
    publicationsResult.error,
    activityResult.error,
    authUsersResult.error,
  ].find(Boolean);
  if (failed) {
    throw new Error("The complete dealership summary could not be loaded.");
  }

  const organisation = organisationResult.data;
  const settings = settingsResult.data;
  const authDirectory = new Map(
    (authUsersResult.data?.users ?? []).map((user) => [
      user.id,
      {
        email: user.email ?? null,
        displayName:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null,
      },
    ]),
  );
  const members = (membersResult.data ?? []).map((rawRow) => {
    const row = rawRow as unknown as MemberDirectoryRow & {
      joined_at: string | null;
    };
    const profile = profileFor(row);
    return {
      userId: String(row.user_id),
      role: String(row.role),
      displayName:
        profile?.display_name ??
        authDirectory.get(String(row.user_id))?.displayName ??
        null,
      email: authDirectory.get(String(row.user_id))?.email ?? null,
      status: String(row.status),
      joinedAt: row.joined_at,
    };
  });
  const vehicles = vehiclesResult.data ?? [];
  const leads = leadsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const pages = pagesResult.data ?? [];
  const openLeadStatuses = new Set([
    "new",
    "contacted",
    "assigned",
    "contact_attempted",
    "qualified",
    "appointment_booked",
    "negotiation",
    "deposit_taken",
  ]);

  return {
    id: String(organisation.id),
    name: String(organisation.name),
    slug: String(organisation.slug),
    subdomain: String(organisation.subdomain),
    status: String(organisation.status) as PlatformDealershipStatus,
    planCode: String(organisation.plan_code),
    websiteStatus: String(
      organisation.website_status,
    ) as PlatformWebsiteStatus,
    onboardingStep: String(organisation.onboarding_step),
    onboardingCompletedAt: organisation.onboarding_completed_at,
    suspendedAt: organisation.suspended_at,
    cancelledAt: organisation.cancelled_at,
    createdAt: String(organisation.created_at),
    contact: {
      telephone: settings.telephone ?? null,
      email: settings.email ?? null,
      address: formattedAddress(settings.address),
    },
    branding: {
      publishedThemeId: String(
        settings.published_theme_id ?? "direct-motors-classic",
      ),
      draftThemeId: String(
        settings.draft_theme_id ??
          settings.published_theme_id ??
          "direct-motors-classic",
      ),
      fontPreset: String(settings.font_preset ?? "classic"),
      themeSettings:
        settings.theme_settings && typeof settings.theme_settings === "object"
          ? (settings.theme_settings as Record<string, unknown>)
          : {},
    },
    domains: (domainsResult.data ?? []).map((domain) => ({
      id: String(domain.id),
      hostname: String(domain.hostname),
      type: domain.type as "subdomain" | "custom",
      status: domain.status as PlatformDomainStatus,
      verifiedAt: domain.verified_at,
      createdAt: String(domain.created_at),
    })),
    members,
    inventory: {
      total: vehicles.length,
      sold: vehicles.filter((vehicle) => vehicle.status === "sold").length,
      inStock: vehicles.filter((vehicle) => vehicle.status !== "sold").length,
    },
    leads: {
      total: leads.length,
      open: leads.filter((lead) => openLeadStatuses.has(String(lead.status)))
        .length,
      won: leads.filter((lead) =>
        ["won", "converted"].includes(String(lead.status)),
      ).length,
      lost: leads.filter((lead) =>
        ["lost", "closed"].includes(String(lead.status)),
      ).length,
    },
    invoices: {
      total: invoices.length,
      outstandingBalance: invoices
        .filter(
          (invoice) =>
            !["cancelled", "void"].includes(String(invoice.status)),
        )
        .reduce((sum, invoice) => sum + Number(invoice.balance ?? 0), 0),
    },
    websitePages: {
      total: pages.length,
      published: pages.filter((page) => page.status === "published").length,
    },
    themePublications: (publicationsResult.data ?? []).map((publication) => ({
      id: String(publication.id),
      themeId: String(publication.theme_id),
      previousThemeId: publication.previous_theme_id,
      publishedAt: String(publication.published_at),
    })),
    recentActivity: (activityResult.data ?? []).map((rawRow) => {
      const row = rawRow as unknown as {
        actor_user_id: string | null;
        action: string;
        change_reason: string | null;
        occurred_at: string;
      };
      return {
        organisationId: id,
        organisationName: String(organisation.name),
        action: String(row.action),
        detail: row.change_reason,
        occurredAt: String(row.occurred_at),
        actorEmail: row.actor_user_id
          ? (authDirectory.get(row.actor_user_id)?.email ?? null)
          : null,
      };
    }),
  };
}

type PlatformActor = Pick<PlatformAdminContext, "userId" | "email" | "role">;

async function writePlatformAudit(input: {
  organisationId: string | null;
  actor: PlatformActor;
  action: string;
  entityType: string;
  entityId: string;
  reason: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  const result = await createAdminSupabaseClient().from("audit_logs").insert({
    organisation_id: input.organisationId,
    actor_user_id: input.actor.userId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    change_reason: input.reason,
    old_values: input.oldValues ?? null,
    new_values: {
      ...(input.newValues ?? {}),
      platform_role: input.actor.role,
    },
  });
  if (result.error) throw new Error("The platform action could not be audited.");
}

export async function logPlatformOverviewAccess(input: {
  actor: PlatformActor;
}) {
  await writePlatformAudit({
    organisationId: null,
    actor: input.actor,
    action: "platform.overview.viewed",
    entityType: "platform_user",
    entityId: input.actor.userId,
    reason: `Platform ${input.actor.role} viewed the network overview.`,
    newValues: { access_mode: "read_only" },
  });
}

export async function logPlatformAdminAccess(input: {
  organisationId: string;
  actor: PlatformActor;
}) {
  await writePlatformAudit({
    organisationId: input.organisationId,
    actor: input.actor,
    action: "platform.dealership.viewed",
    entityType: "organisation",
    entityId: input.organisationId,
    reason: `Platform ${input.actor.role} viewed the dealership summary.`,
    newValues: {
      access_mode: input.actor.role === "support" ? "read_only" : "operator",
    },
  });
}

async function updateOrganisationWithAudit(input: {
  organisationId: string;
  actor: PlatformActor;
  action: string;
  reason: string;
  updates: Record<string, unknown>;
}) {
  const supabase = createAdminSupabaseClient();
  const before = await supabase
    .from("organisations")
    .select("*")
    .eq("id", input.organisationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (before.error || !before.data) throw new Error("Dealership not found.");

  const changed = await supabase
    .from("organisations")
    .update(input.updates)
    .eq("id", input.organisationId)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (changed.error || !changed.data) {
    throw new Error("The dealership could not be updated.");
  }

  try {
    await writePlatformAudit({
      organisationId: input.organisationId,
      actor: input.actor,
      action: input.action,
      entityType: "organisation",
      entityId: input.organisationId,
      reason: input.reason,
      oldValues: before.data,
      newValues: changed.data,
    });
  } catch (error) {
    const rollback = Object.fromEntries(
      Object.keys(input.updates).map((key) => [key, before.data[key]]),
    );
    await supabase
      .from("organisations")
      .update(rollback)
      .eq("id", input.organisationId);
    throw error;
  }
  return changed.data;
}

export async function changePlatformDealershipStatus(input: {
  organisationId: string;
  actor: PlatformActor;
  status: PlatformDealershipStatus;
  reason: string;
}) {
  const now = new Date().toISOString();
  return updateOrganisationWithAudit({
    organisationId: input.organisationId,
    actor: input.actor,
    action: "platform.dealership.status_changed",
    reason: input.reason,
    updates: {
      status: input.status,
      suspended_at: input.status === "suspended" ? now : null,
      cancelled_at: input.status === "cancelled" ? now : null,
    },
  });
}

export async function changePlatformDealershipPlan(input: {
  organisationId: string;
  actor: PlatformActor;
  planCode: string;
  reason: string;
}) {
  return updateOrganisationWithAudit({
    organisationId: input.organisationId,
    actor: input.actor,
    action: "platform.dealership.plan_changed",
    reason: input.reason,
    updates: { plan_code: input.planCode },
  });
}

export async function changePlatformWebsiteStatus(input: {
  organisationId: string;
  actor: PlatformActor;
  websiteStatus: PlatformWebsiteStatus;
  reason: string;
}) {
  return updateOrganisationWithAudit({
    organisationId: input.organisationId,
    actor: input.actor,
    action: "platform.website.status_changed",
    reason: input.reason,
    updates: { website_status: input.websiteStatus },
  });
}

export async function changePlatformTheme(input: {
  organisationId: string;
  actor: PlatformActor;
  themeId: PlatformThemeId;
  mode: "draft" | "publish";
  reason: string;
}) {
  const supabase = createAdminSupabaseClient();
  const before = await supabase
    .from("dealership_settings")
    .select("*")
    .eq("organisation_id", input.organisationId)
    .single();
  if (before.error || !before.data) {
    throw new Error("Dealership settings not found.");
  }

  const updates =
    input.mode === "publish"
      ? {
          published_theme_id: input.themeId,
          draft_theme_id: input.themeId,
        }
      : { draft_theme_id: input.themeId };
  const changed = await supabase
    .from("dealership_settings")
    .update(updates)
    .eq("organisation_id", input.organisationId)
    .select("*")
    .single();
  if (changed.error || !changed.data) {
    throw new Error("The theme could not be updated.");
  }

  let publicationId: string | null = null;
  if (input.mode === "publish") {
    const publication = await supabase
      .from("website_theme_publications")
      .insert({
        organisation_id: input.organisationId,
        theme_id: input.themeId,
        previous_theme_id: before.data.published_theme_id ?? null,
        font_preset: changed.data.font_preset,
        theme_settings: changed.data.theme_settings ?? {},
        published_by: input.actor.userId,
      })
      .select("id")
      .single();
    if (publication.error || !publication.data) {
      await supabase
        .from("dealership_settings")
        .update({
          published_theme_id: before.data.published_theme_id,
          draft_theme_id: before.data.draft_theme_id,
        })
        .eq("organisation_id", input.organisationId);
      throw new Error("The theme publication could not be recorded.");
    }
    publicationId = String(publication.data.id);
  }

  try {
    await writePlatformAudit({
      organisationId: input.organisationId,
      actor: input.actor,
      action:
        input.mode === "publish"
          ? "platform.website.theme_published"
          : "platform.website.theme_draft_changed",
      entityType: "dealership_settings",
      entityId: input.organisationId,
      reason: input.reason,
      oldValues: {
        published_theme_id: before.data.published_theme_id,
        draft_theme_id: before.data.draft_theme_id,
      },
      newValues: updates,
    });
  } catch (error) {
    await supabase
      .from("dealership_settings")
      .update({
        published_theme_id: before.data.published_theme_id,
        draft_theme_id: before.data.draft_theme_id,
      })
      .eq("organisation_id", input.organisationId);
    if (publicationId) {
      await supabase
        .from("website_theme_publications")
        .delete()
        .eq("id", publicationId);
    }
    throw error;
  }
  return changed.data;
}

export async function changePlatformDomainStatus(input: {
  organisationId: string;
  domainId: string;
  actor: PlatformActor;
  status: PlatformDomainStatus;
  reason: string;
}) {
  const supabase = createAdminSupabaseClient();
  const before = await supabase
    .from("dealership_domains")
    .select("*")
    .eq("id", input.domainId)
    .eq("organisation_id", input.organisationId)
    .maybeSingle();
  if (before.error || !before.data) throw new Error("Domain not found.");
  const updates = {
    status: input.status,
    verified_at: input.status === "verified" ? new Date().toISOString() : null,
  };
  const changed = await supabase
    .from("dealership_domains")
    .update(updates)
    .eq("id", input.domainId)
    .eq("organisation_id", input.organisationId)
    .select("*")
    .single();
  if (changed.error || !changed.data) {
    throw new Error("The domain could not be updated.");
  }
  try {
    await writePlatformAudit({
      organisationId: input.organisationId,
      actor: input.actor,
      action: "platform.domain.status_changed",
      entityType: "dealership_domain",
      entityId: input.domainId,
      reason: input.reason,
      oldValues: before.data,
      newValues: changed.data,
    });
  } catch (error) {
    await supabase
      .from("dealership_domains")
      .update({
        status: before.data.status,
        verified_at: before.data.verified_at,
      })
      .eq("id", input.domainId)
      .eq("organisation_id", input.organisationId);
    throw error;
  }
  return changed.data;
}

export type CreatePlatformDealershipInput = {
  name: string;
  slug: string;
  subdomain: string;
  planCode: string;
  telephone?: string | null;
  email?: string | null;
  address?: string | null;
  primaryColour: string;
  accentColour: string;
  fontPreset: string;
  themeId: PlatformThemeId;
  customDomain?: string | null;
  ownerEmail?: string | null;
};

export function buildPlatformSubdomainHostname(
  subdomain: string,
  appUrl: string,
  baseDomain?: string | null,
): string {
  const hostname = (baseDomain?.trim() || new URL(appUrl).hostname)
    .toLowerCase()
    .replace(/^www\./, "");
  if (hostname === "localhost" || /^\d+(?:\.\d+){3}$/.test(hostname)) {
    return `${subdomain}.localhost`;
  }
  return `${subdomain}.${hostname}`;
}

async function findAuthUserIdByEmail(
  email: string,
): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  for (let page = 1; page <= 20; page += 1) {
    const result = await supabase.auth.admin.listUsers({
      page,
      perPage: 1_000,
    });
    if (result.error) throw new Error("The Auth directory could not be checked.");
    const match = result.data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );
    if (match) return match.id;
    if (result.data.users.length < 1_000) return null;
  }
  throw new Error("The Auth directory is too large for an owner-email lookup.");
}

async function establishExistingPlatformOwner(input: {
  organisationId: string;
  ownerEmail: string;
  userId: string;
  actor: PlatformActor;
}): Promise<{ sent: boolean; warning?: string }> {
  const supabase = createAdminSupabaseClient();
  const [roleResult, beforeResult] = await Promise.all([
    supabase.from("roles").select("id").eq("code", "owner").single(),
    supabase
      .from("organisation_members")
      .select("*")
      .eq("organisation_id", input.organisationId)
      .eq("user_id", input.userId)
      .maybeSingle(),
  ]);
  if (roleResult.error || !roleResult.data || beforeResult.error) {
    throw new Error("Existing owner access could not be prepared.");
  }

  const now = new Date().toISOString();
  const membership = await supabase
    .from("organisation_members")
    .upsert(
      {
        organisation_id: input.organisationId,
        user_id: input.userId,
        role_id: roleResult.data.id,
        role: "owner",
        status: "active",
        is_primary: true,
        invited_email: input.ownerEmail,
        invited_at: now,
        joined_at: beforeResult.data?.joined_at ?? now,
        created_by: input.actor.userId,
        deleted_at: null,
      },
      { onConflict: "organisation_id,user_id" },
    )
    .select("id,role,status")
    .single();
  if (membership.error || !membership.data) {
    throw new Error("Existing owner access could not be established.");
  }

  try {
    await writePlatformAudit({
      organisationId: input.organisationId,
      actor: input.actor,
      action: "platform.owner_access.established",
      entityType: "organisation_member",
      entityId: String(membership.data.id),
      reason: "A platform owner established owner access for an existing Auth user.",
      oldValues: beforeResult.data
        ? {
            role: beforeResult.data.role,
            status: beforeResult.data.status,
            deleted_at: beforeResult.data.deleted_at,
          }
        : null,
      newValues: { role: "owner", status: "active" },
    });
  } catch (error) {
    if (beforeResult.data) {
      await supabase
        .from("organisation_members")
        .update({
          role_id: beforeResult.data.role_id,
          role: beforeResult.data.role,
          status: beforeResult.data.status,
          is_primary: beforeResult.data.is_primary,
          invited_email: beforeResult.data.invited_email,
          invited_at: beforeResult.data.invited_at,
          joined_at: beforeResult.data.joined_at,
          deleted_at: beforeResult.data.deleted_at,
        })
        .eq("id", membership.data.id);
    } else {
      await supabase
        .from("organisation_members")
        .delete()
        .eq("id", membership.data.id);
    }
    throw error;
  }

  const reset = await supabase.auth.resetPasswordForEmail(input.ownerEmail, {
    redirectTo: `${getServerEnv().NEXT_PUBLIC_APP_URL}/admin/reset-password`,
  });
  await writePlatformAudit({
    organisationId: input.organisationId,
    actor: input.actor,
    action: reset.error
      ? "platform.owner_reset.delivery_failed"
      : "platform.owner_reset.sent",
    entityType: "organisation_member",
    entityId: String(membership.data.id),
    reason: reset.error
      ? "Owner access was established, but the password reset email failed."
      : "Owner access was established and a password reset email was requested.",
    newValues: {
      email_domain: input.ownerEmail.split("@")[1] ?? "unknown",
      delivery: reset.error ? "failed" : "sent",
    },
  });
  return reset.error
    ? {
        sent: false,
        warning:
          "Owner access is active, but Supabase could not deliver the password reset email.",
      }
    : { sent: true };
}

export async function invitePlatformDealershipOwner(input: {
  organisationId: string;
  ownerEmail: string;
  actor: PlatformActor;
}): Promise<{ sent: boolean; warning?: string }> {
  const supabase = createAdminSupabaseClient();
  const email = input.ownerEmail.trim().toLowerCase();
  const existingUserId = await findAuthUserIdByEmail(email);
  if (existingUserId) {
    return establishExistingPlatformOwner({
      organisationId: input.organisationId,
      ownerEmail: email,
      userId: existingUserId,
      actor: input.actor,
    });
  }
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const invitation = await supabase
    .from("team_invitations")
    .upsert(
      {
        organisation_id: input.organisationId,
        email,
        role: "owner",
        expires_at: expiresAt,
        invited_by: input.actor.userId,
        accepted_at: null,
        accepted_by: null,
      },
      { onConflict: "organisation_id,email" },
    )
    .select("id")
    .single();
  if (invitation.error || !invitation.data) {
    throw new Error("The owner invitation could not be prepared.");
  }

  const authInvitation = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getServerEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/admin/accept-invite")}`,
    data: {
      organisation_id: input.organisationId,
      invited_role: "owner",
      invitation_id: invitation.data.id,
    },
  });

  await writePlatformAudit({
    organisationId: input.organisationId,
    actor: input.actor,
    action: authInvitation.error
      ? "platform.owner_invitation.delivery_failed"
      : "platform.owner_invitation.sent",
    entityType: "team_invitation",
    entityId: String(invitation.data.id),
    reason: authInvitation.error
      ? "The owner invitation record was created but email delivery failed."
      : "A platform owner invited the dealership owner.",
    newValues: {
      email_domain: email.split("@")[1] ?? "unknown",
      expires_at: expiresAt,
      delivery: authInvitation.error ? "failed" : "sent",
    },
  });

  if (authInvitation.error) {
    return {
      sent: false,
      warning:
        "The dealership was created, but Supabase could not deliver the owner invitation. Retry it from the dealership detail page.",
    };
  }
  return { sent: true };
}

export async function createPlatformDealership(input: {
  dealership: CreatePlatformDealershipInput;
  actor: PlatformActor;
}): Promise<{ id: string; invitationWarning?: string }> {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const organisation = await supabase
    .from("organisations")
    .insert({
      name: input.dealership.name,
      slug: input.dealership.slug,
      subdomain: input.dealership.subdomain,
      status: "trial",
      plan_code: input.dealership.planCode,
      website_status: "draft",
      onboarding_step: "complete",
      onboarding_completed_at: now,
      created_by: input.actor.userId,
    })
    .select("id")
    .single();
  if (organisation.error || !organisation.data) {
    const duplicate = organisation.error?.code === "23505";
    throw new Error(
      duplicate
        ? "That slug, subdomain, or custom domain is already in use."
        : "The dealership could not be created.",
    );
  }
  const organisationId = String(organisation.data.id);

  try {
    const settings = await supabase.from("dealership_settings").insert({
      organisation_id: organisationId,
      dealership_name: input.dealership.name,
      telephone: input.dealership.telephone || null,
      email: input.dealership.email || null,
      address: input.dealership.address
        ? { formatted: input.dealership.address }
        : {},
      brand_primary_colour: input.dealership.primaryColour,
      brand_accent_colour: input.dealership.accentColour,
      published_theme_id: input.dealership.themeId,
      draft_theme_id: input.dealership.themeId,
      font_preset: input.dealership.fontPreset,
      theme_settings: {},
      created_by: input.actor.userId,
    });
    if (settings.error) {
      throw new Error("Dealership settings could not be created.");
    }

    const env = getServerEnv();
    const subdomainHostname = buildPlatformSubdomainHostname(
      input.dealership.subdomain,
      env.NEXT_PUBLIC_APP_URL,
      env.MOTOROS_BASE_DOMAIN,
    );
    const domains = [
      {
        organisation_id: organisationId,
        hostname: subdomainHostname,
        type: "subdomain",
        status: "verified",
        verified_at: now,
      },
      ...(input.dealership.customDomain
        ? [
            {
              organisation_id: organisationId,
              hostname: input.dealership.customDomain,
              type: "custom",
              status: "pending",
              verified_at: null,
            },
          ]
        : []),
    ];
    const domainResult = await supabase
      .from("dealership_domains")
      .insert(domains);
    if (domainResult.error) {
      throw new Error("Dealership domains could not be created.");
    }

    await writePlatformAudit({
      organisationId,
      actor: input.actor,
      action: "platform.dealership.created",
      entityType: "organisation",
      entityId: organisationId,
      reason: "A platform owner completed dealership onboarding.",
      newValues: {
        name: input.dealership.name,
        slug: input.dealership.slug,
        subdomain: input.dealership.subdomain,
        plan_code: input.dealership.planCode,
        theme_id: input.dealership.themeId,
        custom_domain_requested: Boolean(input.dealership.customDomain),
      },
    });
  } catch (error) {
    await supabase.from("organisations").delete().eq("id", organisationId);
    throw error;
  }

  let invitationWarning: string | undefined;
  if (input.dealership.ownerEmail) {
    try {
      const invitation = await invitePlatformDealershipOwner({
        organisationId,
        ownerEmail: input.dealership.ownerEmail,
        actor: input.actor,
      });
      invitationWarning = invitation.warning;
    } catch {
      await writePlatformAudit({
        organisationId,
        actor: input.actor,
        action: "platform.owner_invitation.preparation_failed",
        entityType: "organisation",
        entityId: organisationId,
        reason: "The dealership was created, but its owner invitation could not be prepared.",
        newValues: {
          email_domain: input.dealership.ownerEmail.split("@")[1] ?? "unknown",
          delivery: "failed",
        },
      });
      invitationWarning =
        "The owner invitation could not be prepared. Retry it from the dealership detail page.";
    }
  }
  return { id: organisationId, invitationWarning };
}
