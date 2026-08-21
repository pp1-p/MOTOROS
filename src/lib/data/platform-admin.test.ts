import { describe, expect, it } from "vitest";

import {
  applyPlatformDirectoryQuery,
  buildPlatformSubdomainHostname,
  normalisePlatformDirectoryQuery,
  type PlatformDealershipSummary,
} from "./platform-admin";

function dealership(
  overrides: Partial<PlatformDealershipSummary>,
): PlatformDealershipSummary {
  return {
    id: crypto.randomUUID(),
    name: "Example Motors",
    slug: "example-motors",
    subdomain: "example",
    status: "active",
    planCode: "starter",
    websiteStatus: "draft",
    publishedThemeId: "direct-motors-classic",
    ownerName: "Alex Owner",
    ownerEmail: "alex@example.test",
    customDomain: null,
    customDomainStatus: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    lastActivityAt: null,
    staffCount: 1,
    vehicleCount: 0,
    leadCount: 0,
    ...overrides,
  };
}

describe("platform dealership directory", () => {
  it("normalises unsupported query values and clamps paging", () => {
    expect(
      normalisePlatformDirectoryQuery({
        q: "  Direct  ",
        status: "invented",
        sort: "unknown",
        direction: "sideways",
        page: "0",
        pageSize: "49",
      }),
    ).toMatchObject({
      q: "Direct",
      status: "all",
      sort: "created",
      direction: "desc",
      page: 1,
      pageSize: 25,
    });
  });

  it("searches owner and domain fields, then applies tenant filters", () => {
    const rows = [
      dealership({
        name: "Direct Motors",
        ownerEmail: "owner@direct.example",
        customDomain: "direct.example",
        websiteStatus: "published",
        publishedThemeId: "prestige",
      }),
      dealership({ name: "Town Cars", slug: "town-cars", subdomain: "town" }),
    ];
    const result = applyPlatformDirectoryQuery(
      rows,
      normalisePlatformDirectoryQuery({
        q: "direct.example",
        websiteStatus: "published",
        themeId: "prestige",
      }),
    );
    expect(result.totalMatches).toBe(1);
    expect(result.rows[0]?.name).toBe("Direct Motors");
  });

  it("sorts by lead volume and paginates deterministically", () => {
    const rows = [
      dealership({ name: "Alpha", leadCount: 2 }),
      dealership({ name: "Bravo", leadCount: 9 }),
      dealership({ name: "Charlie", leadCount: 5 }),
    ];
    const result = applyPlatformDirectoryQuery(rows, {
      ...normalisePlatformDirectoryQuery(),
      sort: "leads",
      direction: "desc",
      pageSize: 10,
    });
    expect(result.rows.map((row) => row.name)).toEqual([
      "Bravo",
      "Charlie",
      "Alpha",
    ]);
  });
});

describe("MotorOS subdomain hostname", () => {
  it("uses a production application hostname", () => {
    expect(
      buildPlatformSubdomainHostname("direct", "https://www.motoros.co.uk"),
    ).toBe("direct.motoros.co.uk");
  });

  it("uses the explicit local-development hostname convention", () => {
    expect(
      buildPlatformSubdomainHostname("direct", "http://localhost:3000"),
    ).toBe("direct.localhost");
  });

  it("prefers the configured MotorOS base domain over the app hostname", () => {
    expect(
      buildPlatformSubdomainHostname(
        "direct",
        "https://platform.motoros.co.uk",
        "motoros.co.uk",
      ),
    ).toBe("direct.motoros.co.uk");
  });
});
