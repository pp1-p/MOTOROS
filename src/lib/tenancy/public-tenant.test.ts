import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://direct.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    DEALEROS_PUBLIC_ORGANISATION_ID:
      "00000000-0000-4000-8000-000000000001" as string | undefined,
    MOTOROS_BASE_DOMAIN: undefined as string | undefined,
    MOTOROS_LOCAL_ORGANISATION_SLUG: "direct-motors",
    MOTOROS_TRUST_PROXY_HOST: "false",
  },
  from: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(callback: T) => callback,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/demo/store", () => ({
  isDevelopmentDemoMode: () => false,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => mocks.env,
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({ from: mocks.from }),
}));

import {
  isTenantSchemaUnavailableError,
  getPublicTenant,
  PublicTenantNotFoundError,
  resolvePublicTenantFromHeaders,
} from "@/lib/tenancy/public-tenant";

type QueryResult = {
  data: unknown;
  error: unknown;
};

function queryReturning(result: QueryResult) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "in", "is", "not", "limit"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn(async () => result);
  return query;
}

function headersFor(hostname?: string) {
  return new Headers(hostname ? { host: hostname } : undefined);
}

const missingDomainsError = {
  code: "PGRST205",
  message:
    "Could not find the table 'public.dealership_domains' in the schema cache",
};

function useDatabaseResults(
  domainResult: QueryResult,
  organisationResult: QueryResult = { data: null, error: null },
) {
  const domainQuery = queryReturning(domainResult);
  const organisationQuery = queryReturning(organisationResult);
  mocks.from.mockImplementation((table: string) =>
    table === "dealership_domains" ? domainQuery : organisationQuery,
  );
  return { domainQuery, organisationQuery };
}

describe("public tenant schema rollout fallback", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    mocks.env.NEXT_PUBLIC_APP_URL = "https://direct.example";
    mocks.env.DEALEROS_PUBLIC_ORGANISATION_ID =
      "00000000-0000-4000-8000-000000000001";
    mocks.env.MOTOROS_BASE_DOMAIN = undefined;
    mocks.from.mockReset();
    mocks.headers.mockReset();
  });

  it.each([
    {
      code: "42703",
      message: "column organisations.subdomain does not exist",
    },
    {
      code: "42P01",
      message: 'relation "public.dealership_domains" does not exist',
    },
    {
      code: "PGRST204",
      message:
        "Could not find the column 'website_status' of 'organisations' in the schema cache",
    },
    missingDomainsError,
  ])("recognises an expected missing tenancy object", (error) => {
    expect(isTenantSchemaUnavailableError(error)).toBe(true);
  });

  it("does not mask unrelated schema, database, or network failures", () => {
    expect(
      isTenantSchemaUnavailableError({
        code: "PGRST205",
        message: "Could not find the table 'public.customers' in the schema cache",
      }),
    ).toBe(false);
    expect(isTenantSchemaUnavailableError({ code: "PGRST205" })).toBe(false);
    expect(isTenantSchemaUnavailableError({ message: "fetch failed" })).toBe(
      false,
    );
  });

  it("uses only the explicit canonical tenant after validating legacy columns", async () => {
    const organisationId = mocks.env.DEALEROS_PUBLIC_ORGANISATION_ID!;
    const { organisationQuery } = useDatabaseResults(
      { data: null, error: missingDomainsError },
      {
        data: {
          id: organisationId,
          name: "Direct Motors",
          slug: "direct-motors",
          status: "active",
          deleted_at: null,
        },
        error: null,
      },
    );

    const tenant = await resolvePublicTenantFromHeaders(
      headersFor("direct.example"),
    );

    expect(tenant).toMatchObject({
      organisationId,
      name: "Direct Motors",
      slug: "direct-motors",
      lifecycleStatus: "active",
      websiteStatus: "published",
      domainType: "configured",
    });
    expect(organisationQuery.eq).toHaveBeenCalledWith("id", organisationId);
    expect(organisationQuery.in).toHaveBeenCalledWith("status", [
      "trial",
      "active",
    ]);
    expect(organisationQuery.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("uses the configured hostname when static generation has no request headers", async () => {
    const organisationId = mocks.env.DEALEROS_PUBLIC_ORGANISATION_ID!;
    mocks.headers.mockRejectedValue(new Error("No request scope"));
    useDatabaseResults(
      { data: null, error: missingDomainsError },
      {
        data: {
          id: organisationId,
          name: "Direct Motors",
          slug: "direct-motors",
          status: "active",
          deleted_at: null,
        },
        error: null,
      },
    );

    await expect(getPublicTenant()).resolves.toMatchObject({
      organisationId,
      hostname: "direct.example",
      domainType: "configured",
    });
  });

  it("keeps the migrated subdomain resolution path unchanged", async () => {
    mocks.env.MOTOROS_BASE_DOMAIN = "example";
    const organisationQuery = queryReturning({
      data: {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Apex Performance",
        slug: "apex-performance",
        subdomain: "apex",
        status: "active",
        website_status: "published",
      },
      error: null,
    });
    mocks.from.mockReturnValue(organisationQuery);

    await expect(
      resolvePublicTenantFromHeaders(headersFor("apex.example")),
    ).resolves.toMatchObject({
      name: "Apex Performance",
      subdomain: "apex",
      hostname: "apex.example",
      domainType: "subdomain",
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(organisationQuery.eq).toHaveBeenCalledWith("subdomain", "apex");
  });

  it("fails closed on the canonical host without an explicit tenant ID", async () => {
    mocks.env.DEALEROS_PUBLIC_ORGANISATION_ID = undefined;
    useDatabaseResults({ data: null, error: missingDomainsError });

    await expect(
      resolvePublicTenantFromHeaders(headersFor("direct.example")),
    ).rejects.toEqual(missingDomainsError);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it.each(["unknown.example", "localhost", "127.0.0.1"])(
    "does not bridge an unconfigured production host: %s",
    async (hostname) => {
      useDatabaseResults({ data: null, error: missingDomainsError });

      await expect(
        resolvePublicTenantFromHeaders(headersFor(hostname)),
      ).rejects.toEqual(missingDomainsError);
      expect(mocks.from).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { status: "suspended", deleted_at: null },
    { status: "active", deleted_at: "2026-08-21T00:00:00.000Z" },
  ])("rejects an ineligible configured legacy organisation", async (row) => {
    useDatabaseResults(
      { data: null, error: missingDomainsError },
      {
        data: {
          id: mocks.env.DEALEROS_PUBLIC_ORGANISATION_ID,
          name: "Direct Motors",
          slug: "direct-motors",
          ...row,
        },
        error: null,
      },
    );

    await expect(
      resolvePublicTenantFromHeaders(headersFor("direct.example")),
    ).rejects.toEqual(missingDomainsError);
  });

  it.each([undefined, "bad host/path"])(
    "rejects a missing or malformed request hostname",
    async (hostname) => {
      await expect(
        resolvePublicTenantFromHeaders(headersFor(hostname)),
      ).rejects.toBeInstanceOf(PublicTenantNotFoundError);
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it("rethrows a non-schema database failure on the canonical host", async () => {
    const databaseError = { code: "PGRST301", message: "fetch failed" };
    useDatabaseResults({ data: null, error: databaseError });

    await expect(
      resolvePublicTenantFromHeaders(headersFor("direct.example")),
    ).rejects.toEqual(databaseError);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});
