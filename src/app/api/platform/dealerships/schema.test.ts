import { describe, expect, it } from "vitest";

import {
  createPlatformDealershipSchema,
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

  it("accepts a pasted dealership URL and stores only its hostname", () => {
    const parsed = createPlatformDealershipSchema.parse({
      ...validDealership,
      customDomain: "https://www.direct.example/cars?source=motoros",
    });
    expect(parsed.customDomain).toBe("www.direct.example");
  });

  it("rejects a non-http website scheme", () => {
    expect(
      createPlatformDealershipSchema.safeParse({
        ...validDealership,
        customDomain: "javascript:alert(1)",
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

  it("accepts an evidenced verified-domain action", () => {
    expect(
      platformDomainActionSchema.safeParse({
        status: "verified",
        reason: "DNS ownership check passed.",
        confirmation: "CONFIRM",
      }).success,
    ).toBe(true);
  });
});
