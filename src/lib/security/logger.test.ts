import { afterEach, describe, expect, it, vi } from "vitest";

import { log } from "./logger";

afterEach(() => vi.restoreAllMocks());

describe("structured logger redaction", () => {
  it("redacts Auto Trader credential fields but keeps internal record IDs", () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => undefined);

    log("info", "autotrader.test", {
      api_key: "test-api-key-placeholder",
      advertiserId: "test-advertiser-placeholder",
      authorization: "Bearer test-access-token-placeholder",
      vehicleId: "11111111-1111-4111-8111-111111111111",
    });

    const payload = JSON.parse(String(output.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      api_key: "[REDACTED]",
      advertiserId: "[REDACTED]",
      authorization: "[REDACTED]",
      vehicleId: "11111111-1111-4111-8111-111111111111",
    });
  });
});
