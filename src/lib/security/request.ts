import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type Bucket = { count: number; resetAt: number };

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const globalBuckets = globalThis as typeof globalThis & {
  dealerOsRateLimitBuckets?: Map<string, Bucket>;
};

const buckets =
  globalBuckets.dealerOsRateLimitBuckets ??
  (globalBuckets.dealerOsRateLimitBuckets = new Map<string, Bucket>());

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const expected = new URL(getServerEnv().NEXT_PUBLIC_APP_URL).origin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const requestHost = forwardedHost ?? request.headers.get("host");
  const requestProtocol = request.headers.get("x-forwarded-proto") ?? "https";
  const requestOrigin = requestHost ? `${requestProtocol}://${requestHost}` : expected;

  if (origin !== expected && origin !== requestOrigin) {
    throw new Error("Invalid request origin.");
  }
}

export function getClientFingerprint(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return createHash("sha256")
    .update(`${ip}:${request.headers.get("user-agent") ?? "unknown"}`)
    .digest("hex")
    .slice(0, 24);
}

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}

/**
 * Enforces a rate limit in Supabase so it is shared across Vercel instances.
 * The in-memory limiter remains as a fail-safe for local development and
 * temporary database outages.
 */
export async function checkSharedRateLimit(
  key: string,
  {
    action,
    limit,
    windowMs,
  }: { action: string; limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const env = getServerEnv();
  const windowMinutes = Math.max(1, Math.ceil(windowMs / 60_000));

  if (
    env.NEXT_PUBLIC_SUPABASE_URL &&
    env.SUPABASE_SERVICE_ROLE_KEY &&
    env.DEALEROS_PUBLIC_ORGANISATION_ID
  ) {
    try {
      const { error } = await createAdminSupabaseClient().rpc(
        "consume_public_rate_limit",
        {
          target_organisation_id: env.DEALEROS_PUBLIC_ORGANISATION_ID,
          target_action: action,
          client_token: key,
          maximum_attempts: limit,
          window_minutes: windowMinutes,
        },
      );

      if (!error) {
        return {
          allowed: true,
          remaining: Math.max(0, limit - 1),
          retryAfterSeconds: 0,
        };
      }

      if (
        error.code === "P0001" &&
        error.message.toLowerCase().includes("too many submissions")
      ) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: windowMinutes * 60,
        };
      }
    } catch {
      // Fall through to the local fail-safe below.
    }
  }

  return checkRateLimit(key, { limit, windowMs });
}

export function secureCompare(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
