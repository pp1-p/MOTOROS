import "server-only";

import {
  resolveEntitlements,
  type PlanCode,
  type ResolvedEntitlements,
} from "@/lib/entitlements";
import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type TenantEntitlements = {
  plan: PlanCode;
  subscriptionStatus: string;
  features: ResolvedEntitlements;
};

function isPlanCode(value: unknown): value is PlanCode {
  return ["starter", "professional", "premium", "custom"].includes(
    String(value),
  );
}

function fallbackEntitlements(): TenantEntitlements {
  const plan: PlanCode = isDevelopmentDemoMode() ? "professional" : "starter";
  return {
    plan,
    subscriptionStatus: isDevelopmentDemoMode() ? "demo" : "unconfigured",
    features: resolveEntitlements(plan),
  };
}

export async function getTenantEntitlements(
  organisationId: string,
): Promise<TenantEntitlements> {
  if (
    !isSupabaseConfigured() ||
    !getServerEnv().SUPABASE_SERVICE_ROLE_KEY
  ) {
    return fallbackEntitlements();
  }

  const supabase = createAdminSupabaseClient();
  const [subscriptionResult, overrideResult] = await Promise.all([
    supabase
      .from("dealership_subscriptions")
      .select("plan_code,status")
      .eq("organisation_id", organisationId)
      .maybeSingle(),
    supabase
      .from("dealership_entitlements")
      .select("feature_key,enabled,expires_at")
      .eq("organisation_id", organisationId),
  ]);

  if (subscriptionResult.error || !subscriptionResult.data) {
    return fallbackEntitlements();
  }

  const plan = isPlanCode(subscriptionResult.data.plan_code)
    ? subscriptionResult.data.plan_code
    : "starter";
  const overrides = (overrideResult.data ?? []).map((row) => ({
    featureKey: String(row.feature_key),
    enabled: Boolean(row.enabled),
    expiresAt: (row.expires_at as string | null) ?? null,
  }));

  return {
    plan,
    subscriptionStatus: String(subscriptionResult.data.status),
    features: resolveEntitlements(plan, overrides),
  };
}
