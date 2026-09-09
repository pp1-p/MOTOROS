import { describe, expect, it } from "vitest";

import {
  createPlatformDealershipSchema,
  platformCustomDomainCreateSchema,
  platformCustomDomainProvisionSchema,
  platformDealershipActionSchema,
  platformDomainActionSchema,
} from "./schema";

const validDealership = {
  name: "Direct Motors",
  slug: "direct-motors",
  subdomain: "direct",
  planCode: "starter",
  telephone: "01922 625925",
  email: "hello@direct.example",
  address: "Walsall, United Kingdom",
  primaryColour: "#172033",
  accentColour: "#D4A853",
  fontPreset: "classic",
  themeId: "direct-motors-classic",
  customDomain: "www.direct.example",
  ownerEmail: "owner@direct.example",
  confirmation: "CONFIRM",
};

describe("platform onboarding validation", () => {
  it("accepts a complete, normalised dealership payload", () => {
    const parsed = createPlatformDealershipSchema.parse(validDealership);
    expect(parsed.slug).toBe("direct-motors");
    expect(parsed.customDomain).toBe("www.direct.example");
  });

  it("rejects a custom domain containing a protocol or path", () => {
    expect(
      createPlatformDealershipSchema.safeParse({
        ...validDealership,
        customDomain: "https://direct.example/path",
      }).success,
    ).toBe(false);
  });

  it("requires explicit server-verifiable confirmation", () => {
    expect(
      createPlatformDealershipSchema.safeParse({
        ...validDealership,
        confirmation: "yes",
      }).success,
    ).toBe(false);
  });
});

describe("platform mutation validation", () => {
  it("requires a meaningful reason for lifecycle changes", () => {
    expect(
      platformDealershipActionSchema.safeParse({
        action: "status",
        status: "suspended",
        reason: "short",
        confirmation: "CONFIRM",
      }).success,
    ).toBe(false);
  });

  it("still validates low-level domain status actions", () => {
    expect(
      platformDomainActionSchema.safeParse({
        status: "disabled",
        reason: "Dealer requested the hostname be disabled.",
        confirmation: "CONFIRM",
      }).success,
    ).toBe(true);
  });

  it("validates a post-onboarding custom hostname without accepting URLs", () => {
    expect(
      platformCustomDomainCreateSchema.safeParse({
        hostname: "WWW.Dealer.co.uk",
        reason: "Dealer requested their production hostname.",
        confirmation: "CONFIRM",
      }).success,
    ).toBe(true);
    expect(
      platformCustomDomainCreateSchema.safeParse({
        hostname: "https://dealer.co.uk",
        reason: "Dealer requested their production hostname.",
        confirmation: "CONFIRM",
      }).success,
    ).toBe(false);
  });

  it("requires explicit confirmation before contacting Vercel", () => {
    expect(
      platformCustomDomainProvisionSchema.safeParse({ confirmation: "CONFIRM" })
        .success,
    ).toBe(true);
    expect(
      platformCustomDomainProvisionSchema.safeParse({ confirmation: "yes" }).success,
    ).toBe(false);
  });
});
