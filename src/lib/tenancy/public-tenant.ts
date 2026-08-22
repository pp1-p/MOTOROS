import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  type HeaderReader,
  isLocalHostname,
  normaliseHostname,
  requestHostname,
  requestOrigin,
  subdomainForHostname,
} from "@/lib/tenancy/hostname";

const DIRECT_MOTORS_ID = "00000000-0000-4000-8000-000000000001";

export type PublicTenantContext = {
  organisationId: string;
  name: string;
  slug: string;
  subdomain: string;
  hostname: string;
  baseUrl: string;
  websiteStatus: "published";
  lifecycleStatus: "trial" | "active";
  domainType: "subdomain" | "custom" | "configured" | "local";
};

type EligibleOrganisation = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  status: "trial" | "active";
  website_status: "published";
};

type LegacyEligibleOrganisation = {
  id: string;
  name: string;
  slug: string;
  status: "trial" | "active";
  deleted_at: null;
};

export class PublicTenantNotFoundError extends Error {
  constructor(message = "No published dealership is configured for this hostname.") {
    super(message);
    this.name = "PublicTenantNotFoundError";
  }
}

const TENANT_SCHEMA_UNAVAILABLE_CODES = new Set([
  "42703", // PostgreSQL undefined_column
  "42P01", // PostgreSQL undefined_table
  "PGRST204", // PostgREST column missing from the schema cache
  "PGRST205", // PostgREST table missing from the schema cache
]);

export function isTenantSchemaUnavailableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate.message !== "string") return false;
  const referencesExpectedTenancyObject =
    /dealership_domains/i.test(candidate.message) ||
    /organisations[^\n]*(?:subdomain|website_status)/i.test(candidate.message) ||
    /(?:subdomain|website_status)[^\n]*organisations/i.test(candidate.message);
  const isMissingSchemaError =
    (typeof candidate.code === "string" &&
      TENANT_SCHEMA_UNAVAILABLE_CODES.has(candidate.code)) ||
    /(?:column|relation) .+ does not exist/i.test(candidate.message) ||
    /could not find (?:the )?(?:column|table) .+ in the schema cache/i.test(
      candidate.message,
    );
  return referencesExpectedTenancyObject && isMissingSchemaError;
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function legacyFallbackScope(hostname: string) {
  const env = getServerEnv();
  const appHostname = fallbackHostname();
  const isConfiguredHost = appHostname !== null && hostname === appHostname;

  if (isProductionRuntime()) {
    return env.DEALEROS_PUBLIC_ORGANISATION_ID && isConfiguredHost
      ? ("configured" as const)
      : null;
  }

  if (isConfiguredHost && env.DEALEROS_PUBLIC_ORGANISATION_ID) {
    return "configured" as const;
  }
  return isBareLocalHostname(hostname) ? ("local" as const) : null;
}

async function legacySchemaFallback(
  hostname: string,
  baseUrl: string,
): Promise<PublicTenantContext | null> {
  const env = getServerEnv();
  const scope = legacyFallbackScope(hostname);
  if (!scope) return null;

  const supabase = createAdminSupabaseClient();
  const field = scope === "configured" ? "id" : "slug";
  const value =
    scope === "configured"
      ? env.DEALEROS_PUBLIC_ORGANISATION_ID
      : env.MOTOROS_LOCAL_ORGANISATION_SLUG;
  if (!value) return null;

  const result = await supabase
    .from("organisations")
    .select("id,name,slug,status,deleted_at")
    .eq(field, value)
    .in("status", ["trial", "active"])
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  const organisation = result.data as LegacyEligibleOrganisation | null;
  if (
    !organisation ||
    organisation.deleted_at !== null ||
    !["trial", "active"].includes(organisation.status)
  ) {
    return null;
  }

  return {
    organisationId: organisation.id,
    name: organisation.name,
    slug: organisation.slug,
    subdomain: organisation.slug,
    hostname,
    baseUrl,
    websiteStatus: "published",
    lifecycleStatus: organisation.status,
    domainType: scope,
  };
}

function mayUseLegacyConfiguration(hostname: string) {
  return legacyFallbackScope(hostname) !== null;
}

function trustProxyHost() {
  const env = getServerEnv();
  return env.MOTOROS_TRUST_PROXY_HOST === "true" || process.env.VERCEL === "1";
}

function fallbackHostname() {
  try {
    return normaliseHostname(new URL(getServerEnv().NEXT_PUBLIC_APP_URL).hostname);
  } catch {
    return null;
  }
}

function isBareLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("127.")
  );
}

function developmentFallback(
  hostname: string,
  baseUrl: string,
): PublicTenantContext {
  return {
    organisationId:
      getServerEnv().DEALEROS_PUBLIC_ORGANISATION_ID ?? DIRECT_MOTORS_ID,
    name: "Direct Motors",
    slug: "direct-motors",
    subdomain: "direct-motors",
    hostname,
    baseUrl,
    websiteStatus: "published",
    lifecycleStatus: "active",
    domainType: isLocalHostname(hostname) ? "local" : "configured",
  };
}

async function eligibleOrganisation(
  field: "id" | "slug" | "subdomain",
  value: string,
) {
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("organisations")
    .select("id,name,slug,subdomain,status,website_status")
    .eq(field, value)
    .in("status", ["trial", "active"])
    .eq("website_status", "published")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return (result.data as EligibleOrganisation | null) ?? null;
}

async function organisationForVerifiedDomain(hostname: string) {
  const supabase = createAdminSupabaseClient();
  const domain = await supabase
    .from("dealership_domains")
    .select("organisation_id,type")
    .eq("hostname", hostname)
    .eq("status", "verified")
    .not("verified_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (domain.error) throw domain.error;
  if (!domain.data) return null;
  const organisation = await eligibleOrganisation(
    "id",
    String(domain.data.organisation_id),
  );
  if (!organisation) return null;
  return {
    organisation,
    domainType:
      domain.data.type === "subdomain"
        ? ("subdomain" as const)
        : ("custom" as const),
  };
}

async function configuredFallback(hostname: string) {
  const env = getServerEnv();
  if (!mayUseLegacyConfiguration(hostname)) return null;

  if (env.DEALEROS_PUBLIC_ORGANISATION_ID) {
    const organisation = await eligibleOrganisation(
      "id",
      env.DEALEROS_PUBLIC_ORGANISATION_ID,
    );
    return organisation
      ? { organisation, domainType: "configured" as const }
      : null;
  }

  if (isBareLocalHostname(hostname)) {
    const organisation = await eligibleOrganisation(
      "slug",
      env.MOTOROS_LOCAL_ORGANISATION_SLUG,
    );
    return organisation ? { organisation, domainType: "local" as const } : null;
  }

  return null;
}

export async function resolvePublicTenantFromHeaders(
  requestHeaders: HeaderReader,
): Promise<PublicTenantContext> {
  const trustForwardedHost = trustProxyHost();
  const hostname = requestHostname(requestHeaders, { trustForwardedHost });
  if (!hostname) throw new PublicTenantNotFoundError("The request hostname is invalid.");

  const baseUrl = requestOrigin(requestHeaders, hostname, { trustForwardedHost });
  if (!isSupabaseConfigured()) {
    if (isDevelopmentDemoMode()) return developmentFallback(hostname, baseUrl);
    throw new PublicTenantNotFoundError("Tenant resolution is not configured.");
  }

  const env = getServerEnv();
  const subdomain = subdomainForHostname(hostname, env.MOTOROS_BASE_DOMAIN);
  let resolved:
    | {
        organisation: EligibleOrganisation;
        domainType: PublicTenantContext["domainType"];
      }
    | null = null;

  try {
    if (subdomain) {
      const organisation = await eligibleOrganisation("subdomain", subdomain);
      if (organisation) resolved = { organisation, domainType: "subdomain" };
    }

    resolved ??= await organisationForVerifiedDomain(hostname);
    resolved ??= await configuredFallback(hostname);
  } catch (error) {
    // A deployment can be built immediately before the forward-only tenancy
    // migration is applied. Keep only the explicitly configured legacy host
    // buildable; arbitrary or custom hostnames must continue to fail closed.
    if (
      mayUseLegacyConfiguration(hostname) &&
      isTenantSchemaUnavailableError(error)
    ) {
      const legacyTenant = await legacySchemaFallback(hostname, baseUrl);
      if (legacyTenant) return legacyTenant;
    }
    throw error;
  }

  if (!resolved) throw new PublicTenantNotFoundError();
  const { organisation } = resolved;
  return {
    organisationId: organisation.id,
    name: organisation.name,
    slug: organisation.slug,
    subdomain: organisation.subdomain,
    hostname,
    baseUrl,
    websiteStatus: "published",
    lifecycleStatus: organisation.status,
    domainType: resolved.domainType,
  };
}

export function resolvePublicTenantForRequest(request: Request) {
  if (request.headers.get("host")) {
    return resolvePublicTenantFromHeaders(request.headers);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("host", new URL(request.url).host);
  return resolvePublicTenantFromHeaders(requestHeaders);
}

const resolveCurrentPublicTenant = cache(async () => {
  let requestHeaders: HeaderReader;
  try {
    requestHeaders = await headers();
  } catch {
    // Static metadata/parameter generation has no request headers. It may use
    // only the explicitly configured application origin, never an arbitrary
    // first tenant from the database.
    const fallbackHeaders = new Headers();
    fallbackHeaders.set("host", new URL(getServerEnv().NEXT_PUBLIC_APP_URL).host);
    requestHeaders = fallbackHeaders;
  }
  return resolvePublicTenantFromHeaders(requestHeaders);
});

export function getPublicTenant() {
  return resolveCurrentPublicTenant();
}
