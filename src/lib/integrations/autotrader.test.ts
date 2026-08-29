import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseAutoTraderSignature,
  getAutoTraderCredentialBinding,
  resolveAutoTraderWebhookAdvertiserId,
  verifyAutoTraderWebhook,
} from "./autotrader";

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    AUTOTRADER_WEBHOOK_SECRET: "test-webhook-secret-placeholder",
  }),
}));

afterEach(() => vi.useRealTimers());

describe("resolveAutoTraderWebhookAdvertiserId", () => {
  it.each([
    [{ advertiserId: "12345", data: {} }, "12345"],
    [{ advertiser: { id: "dealer-7" }, data: {} }, "dealer-7"],
    [{ data: { advertiserIdentifier: "account-9" } }, "account-9"],
    [{ data: { advertiser: { identifier: "retailer-2" } } }, "retailer-2"],
    [{ data: { advertiser: { advertiserId: "retailer-3" } } }, "retailer-3"],
  ])("resolves an explicit advertiser identifier", (payload, expected) => {
    expect(resolveAutoTraderWebhookAdvertiserId(payload)).toEqual({
      ok: true,
      advertiserId: expected,
    });
  });

  it("trims matching identifiers and allows duplicate representations", () => {
    expect(
      resolveAutoTraderWebhookAdvertiserId({
        advertiserId: " 12345 ",
        data: { advertiser: { id: "12345" } },
      }),
    ).toEqual({ ok: true, advertiserId: "12345" });
  });

  it("rejects a payload with no advertiser discriminator", () => {
    expect(
      resolveAutoTraderWebhookAdvertiserId({ id: "event-1", data: {} }),
    ).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects conflicting advertiser discriminators", () => {
    expect(
      resolveAutoTraderWebhookAdvertiserId({
        advertiserId: "dealer-a",
        data: { advertiserId: "dealer-b" },
      }),
    ).toEqual({ ok: false, reason: "conflicting" });
  });
});

describe("Auto Trader notification signatures", () => {
  it("parses the documented t and v1 signature values", () => {
    expect(
      parseAutoTraderSignature(`t=1724846400,v1=${"a".repeat(64)}`),
    ).toEqual({ timestamp: "1724846400", signature: "a".repeat(64) });
  });

  it("verifies HMAC-SHA256 against timestamp dot raw body", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T10:00:00Z"));
    const body = '{"type":"STOCK_UPDATE"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac(
      "sha256",
      "test-webhook-secret-placeholder",
    )
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(
      verifyAutoTraderWebhook({
        rawBody: body,
        signatureHeader: `t=${timestamp},v1=${signature}`,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects stale notifications", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T10:10:01Z"));
    const timestamp = String(
      Math.floor(Date.parse("2026-08-28T10:00:00Z") / 1000),
    );

    expect(
      verifyAutoTraderWebhook({
        rawBody: "{}",
        signatureHeader: `t=${timestamp},v1=${"a".repeat(64)}`,
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("Auto Trader dealership credential binding", () => {
  it("produces a deterministic non-reversible fingerprint", () => {
    const first = getAutoTraderCredentialBinding({
      key: "test-api-key-placeholder",
      secret: "test-api-secret-placeholder",
      advertiserId: "test-advertiser-placeholder",
    });
    const second = getAutoTraderCredentialBinding({
      key: "test-api-key-placeholder",
      secret: "test-api-secret-placeholder",
      advertiserId: "test-advertiser-placeholder",
    });
    const different = getAutoTraderCredentialBinding({
      key: "test-api-key-placeholder",
      secret: "test-api-secret-placeholder",
      advertiserId: "different-advertiser-placeholder",
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).not.toContain("test-advertiser-placeholder");
  });
});
