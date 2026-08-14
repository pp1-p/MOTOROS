import { describe, expect, it } from "vitest";

import {
  resolveEntitlements,
  resolveSubscriptionEntitlements,
} from "@/lib/entitlements";

describe("feature entitlements", () => {
  it("keeps the Starter core available without enabling social publishing", () => {
    const result = resolveEntitlements("starter");
    expect(result["dealership.core"]).toBe(true);
    expect(result["website.basic"]).toBe(true);
    expect(result["social.publishing"]).toBe(false);
  });

  it("layers tenant overrides on top of plan defaults", () => {
    const result = resolveEntitlements("professional", [
      { featureKey: "social.inbox", enabled: true },
      { featureKey: "social.publishing", enabled: false },
    ]);
    expect(result["social.inbox"]).toBe(true);
    expect(result["social.publishing"]).toBe(false);
  });

  it("ignores expired and unknown overrides", () => {
    const result = resolveEntitlements(
      "starter",
      [
        {
          featureKey: "social.inbox",
          enabled: true,
          expiresAt: "2026-01-01T00:00:00.000Z",
        },
        { featureKey: "unknown.feature", enabled: true },
      ],
      new Date("2026-08-14T00:00:00.000Z"),
    );
    expect(result["social.inbox"]).toBe(false);
  });

  it("removes paid features when a subscription is not active", () => {
    const active = resolveSubscriptionEntitlements("professional", "active");
    const pastDue = resolveSubscriptionEntitlements(
      "professional",
      "past_due",
      [{ featureKey: "social.publishing", enabled: true }],
    );
    expect(active["social.publishing"]).toBe(true);
    expect(pastDue["dealership.core"]).toBe(true);
    expect(pastDue["social.publishing"]).toBe(false);
    expect(pastDue["website.themes.premium"]).toBe(false);
  });
});
