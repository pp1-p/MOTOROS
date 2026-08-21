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

export class PublicTenantNotFoundError extends Error {
  constructor(message = "No published dealership is configured for this hostname.") {
    super(message);
    this.name = "PublicTenantNotFoundError";
  }
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
  const appHostname = fallbackHostname();
  const mayUseLegacyConfiguration =
    isBareLocalHostname(hostname) ||
    (appHostname !== null && hostname === appHostname);
  if (!mayUseLegacyConfiguration) return null;

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
  const hostname =
    requestHostname(requestHeaders, { trustForwardedHost }) ?? fallbackHostname();
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

  if (subdomain) {
    const organisation = await eligibleOrganisation("subdomain", subdomain);
    if (organisation) resolved = { organisation, domainType: "subdomain" };
  }

  resolved ??= await organisationForVerifiedDomain(hostname);
  resolved ??= await configuredFallback(hostname);

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
