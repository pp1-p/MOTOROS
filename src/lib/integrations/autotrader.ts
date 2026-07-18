import "server-only";

import { createHmac } from "node:crypto";

import { getServerEnv } from "@/lib/env";
import { secureCompare } from "@/lib/security/request";

export type AutoTraderConnectionStatus =
  | "not_configured"
  | "configured_unverified"
  | "connected"
  | "authentication_failed"
  | "permission_missing"
  | "syncing"
  | "error";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Resolve the advertiser discriminator from the explicit shapes used by
 * Auto Trader account integrations. If multiple fields disagree, fail closed
 * rather than routing a signed event to the wrong dealership.
 */
export function resolveAutoTraderWebhookAdvertiserId(payload: unknown):
  | { ok: true; advertiserId: string }
  | { ok: false; reason: "missing" | "conflicting" } {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const rootAdvertiser = asRecord(root?.advertiser);
  const dataAdvertiser = asRecord(data?.advertiser);
  const candidates = [
    nonEmptyString(root?.advertiserId),
    nonEmptyString(root?.advertiserIdentifier),
    nonEmptyString(rootAdvertiser?.id),
    nonEmptyString(rootAdvertiser?.identifier),
    nonEmptyString(data?.advertiserId),
    nonEmptyString(data?.advertiserIdentifier),
    nonEmptyString(dataAdvertiser?.id),
    nonEmptyString(dataAdvertiser?.identifier),
  ].filter((value): value is string => value !== null);
  const uniqueCandidates = [...new Set(candidates)];

  if (uniqueCandidates.length === 0) return { ok: false, reason: "missing" };
  if (uniqueCandidates.length > 1) {
    return { ok: false, reason: "conflicting" };
  }
  return { ok: true, advertiserId: uniqueCandidates[0]! };
}

export function getAutoTraderConfigurationStatus(): {
  status: AutoTraderConnectionStatus;
  message: string;
} {
  const env = getServerEnv();
  const values = [
    env.AUTOTRADER_CLIENT_ID,
    env.AUTOTRADER_CLIENT_SECRET,
    env.AUTOTRADER_ADVERTISER_ID,
    env.AUTOTRADER_API_BASE_URL,
  ];
  if (values.every((value) => !value)) {
    return {
      status: "not_configured",
      message: "Manual stock management, CSV and reference fields remain available.",
    };
  }
  if (values.some((value) => !value)) {
    return {
      status: "authentication_failed",
      message: "One or more required Auto Trader credentials are missing.",
    };
  }
  return {
    status: "configured_unverified",
    message:
      "Credentials are present but have not been claimed as connected. Verify the dealership's Connect permissions before enabling sync.",
  };
}

export function verifyAutoTraderWebhook(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
}) {
  const secret = getServerEnv().AUTOTRADER_WEBHOOK_SECRET;
  if (!secret) return { ok: false as const, reason: "Webhook secret is not configured." };
  if (!input.signature || !input.timestamp) {
    return { ok: false as const, reason: "Webhook signature or timestamp is missing." };
  }

  const timestampMs = Number(input.timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) {
    return { ok: false as const, reason: "Webhook timestamp is outside the replay window." };
  }
  const expected = `sha256=${createHmac("sha256", secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex")}`;

  return secureCompare(expected, input.signature)
    ? { ok: true as const }
    : { ok: false as const, reason: "Webhook signature is invalid." };
}
