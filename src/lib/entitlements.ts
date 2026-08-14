export const featureKeys = [
  "dealership.core",
  "website.basic",
  "website.themes.premium",
  "website.custom_domain",
  "social.connections",
  "social.publishing",
  "social.inbox",
  "analytics.advanced",
  "automation",
] as const;

export type FeatureKey = (typeof featureKeys)[number];
export type PlanCode = "starter" | "professional" | "premium" | "custom";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "suspended";

export type EntitlementOverride = {
  featureKey: string;
  enabled: boolean;
  expiresAt?: string | null;
};

const planDefaults: Record<PlanCode, readonly FeatureKey[]> = {
  starter: ["dealership.core", "website.basic"],
  professional: [
    "dealership.core",
    "website.basic",
    "website.themes.premium",
    "social.connections",
    "social.publishing",
  ],
  premium: featureKeys,
  // Custom plans start from Premium so a billing integration cannot
  // accidentally remove existing functionality. Explicit overrides can
  // narrow the package after the commercial model is agreed.
  custom: featureKeys,
};

export type ResolvedEntitlements = Record<FeatureKey, boolean>;

export function resolveEntitlements(
  plan: PlanCode,
  overrides: readonly EntitlementOverride[] = [],
  now = new Date(),
): ResolvedEntitlements {
  const included = new Set(planDefaults[plan]);
  const resolved = Object.fromEntries(
    featureKeys.map((feature) => [feature, included.has(feature)]),
  ) as ResolvedEntitlements;

  for (const override of overrides) {
    if (!featureKeys.includes(override.featureKey as FeatureKey)) continue;
    if (override.expiresAt && new Date(override.expiresAt) <= now) continue;
    resolved[override.featureKey as FeatureKey] = override.enabled;
  }

  return resolved;
}

export function resolveSubscriptionEntitlements(
  plan: PlanCode,
  status: string,
  overrides: readonly EntitlementOverride[] = [],
  now = new Date(),
): ResolvedEntitlements {
  if (status === "active" || status === "trialing") {
    return resolveEntitlements(plan, overrides, now);
  }

  // Keep the safe Starter foundation available, but do not let an expired,
  // cancelled or suspended subscription retain paid plan features. Negative
  // overrides remain effective so a disabled feature never fails open.
  return resolveEntitlements(
    "starter",
    overrides.filter((override) => !override.enabled),
    now,
  );
}

export function hasEntitlement(
  entitlements: ResolvedEntitlements,
  feature: FeatureKey,
) {
  return entitlements[feature];
}
