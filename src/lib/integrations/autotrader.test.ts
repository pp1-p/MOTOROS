import { describe, expect, it } from "vitest";

import { resolveAutoTraderWebhookAdvertiserId } from "./autotrader";

describe("resolveAutoTraderWebhookAdvertiserId", () => {
  it.each([
    [{ advertiserId: "12345", data: {} }, "12345"],
    [{ advertiser: { id: "dealer-7" }, data: {} }, "dealer-7"],
    [{ data: { advertiserIdentifier: "account-9" } }, "account-9"],
    [{ data: { advertiser: { identifier: "retailer-2" } } }, "retailer-2"],
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
