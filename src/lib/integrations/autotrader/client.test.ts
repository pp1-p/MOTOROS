import { describe, expect, it, vi } from "vitest";

import { AutoTraderClient } from "./client";
import { AutoTraderApiError } from "./types";

const credentials = {
  key: "test-api-key-placeholder",
  secret: "test-api-secret-placeholder",
  advertiserId: "test-advertiser-placeholder",
};
const now = Date.parse("2026-08-28T10:00:00Z");

function json(value: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function authResponse() {
  return json({
    access_token: "test-access-token-placeholder",
    expires_at: "2026-08-28T10:15:00Z",
  });
}

function mockFetch(...responses: Response[]) {
  const mock = vi.fn();
  for (const response of responses) mock.mockResolvedValueOnce(response);
  return mock as unknown as typeof fetch;
}

describe("AutoTraderClient", () => {
  it("constructs sandbox authentication and required stock headers", async () => {
    const fetch = mockFetch(
      authResponse(),
      json({ results: [], totalResults: 0 }),
    );
    const client = new AutoTraderClient(credentials, { fetch, now: () => now });

    await client.verifyConnection();

    const authentication = vi.mocked(fetch).mock.calls[0]!;
    expect(String(authentication[0])).toBe(
      "https://api-sandbox.autotrader.co.uk/authenticate",
    );
    expect(authentication[1]).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    expect(authentication[1]?.body).toBe(
      "key=test-api-key-placeholder&secret=test-api-secret-placeholder",
    );

    const stock = vi.mocked(fetch).mock.calls[1]!;
    expect(String(stock[0])).toContain(
      "https://api-sandbox.autotrader.co.uk/stock?advertiserId=test-advertiser-placeholder",
    );
    expect(stock[1]).toMatchObject({
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer test-access-token-placeholder",
      },
    });
  });

  it("reuses a valid access token", async () => {
    const fetch = mockFetch(
      authResponse(),
      json({ results: [], totalResults: 0 }),
      json({ results: [], totalResults: 0 }),
    );
    const client = new AutoTraderClient(credentials, { fetch, now: () => now });

    await client.listStockPage({ page: 1, pageSize: 20 });
    await client.listStockPage({ page: 2, pageSize: 20 });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    expect(String(vi.mocked(fetch).mock.calls[2]![0])).toContain("page=2");
  });

  it("loads every documented stock page", async () => {
    const fetch = mockFetch(
      authResponse(),
      json({
        results: [
          { metadata: { stockId: "stock-1" } },
          { metadata: { stockId: "stock-2" } },
        ],
        totalResults: 3,
      }),
      json({
        results: [{ metadata: { stockId: "stock-3" } }],
        totalResults: 3,
      }),
    );
    const client = new AutoTraderClient(credentials, { fetch, now: () => now });

    const records = await client.listAllStock(2);

    expect(records).toHaveLength(3);
    expect(String(vi.mocked(fetch).mock.calls[1]![0])).toContain("page=1&pageSize=2");
    expect(String(vi.mocked(fetch).mock.calls[2]![0])).toContain("page=2&pageSize=2");
  });

  it("retries a rate-limited read after the documented delay", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetch = mockFetch(
      authResponse(),
      json({ message: "wait" }, 429),
      json({ results: [], totalResults: 0 }),
    );
    const client = new AutoTraderClient(credentials, {
      fetch,
      sleep,
      now: () => now,
    });

    await client.listStockPage({ page: 1, pageSize: 20 });

    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("retries an idempotent patch after a 503 response", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetch = mockFetch(
      authResponse(),
      json({ message: "unavailable" }, 503),
      json({}, 202),
    );
    const client = new AutoTraderClient(credentials, {
      fetch,
      sleep,
      now: () => now,
    });

    await client.updateStock("stock-1", {
      metadata: { lifecycleState: "FORECOURT" },
    });

    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });

  it("does not retry stock creation", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetch = mockFetch(authResponse(), json({ message: "unavailable" }, 503));
    const client = new AutoTraderClient(credentials, {
      fetch,
      sleep,
      now: () => now,
    });

    await expect(client.createStock({ vehicle: {} })).rejects.toMatchObject({
      code: "service_unavailable",
      retryable: false,
    });
    expect(sleep).not.toHaveBeenCalled();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("captures the existing stock ID from a documented duplicate response", async () => {
    const fetch = mockFetch(
      authResponse(),
      json({ message: "Duplicate stockId=existing-stock-7" }, 409),
    );
    const client = new AutoTraderClient(credentials, { fetch, now: () => now });

    const error = await client.createStock({ vehicle: {} }).catch((value) => value);

    expect(error).toBeInstanceOf(AutoTraderApiError);
    expect(error).toMatchObject({
      code: "duplicate_stock",
      existingStockId: "existing-stock-7",
    });
  });

  it("accepts a structured stock ID in a duplicate response", async () => {
    const fetch = mockFetch(
      authResponse(),
      json({ stockId: "existing-stock-8", message: "Duplicate stock" }, 409),
    );
    const client = new AutoTraderClient(credentials, { fetch, now: () => now });

    const error = await client.createStock({ vehicle: {} }).catch((value) => value);

    expect(error).toMatchObject({
      code: "duplicate_stock",
      existingStockId: "existing-stock-8",
    });
  });

  it("returns safe API errors with the Cloudflare request identifier", async () => {
    const fetch = mockFetch(
      authResponse(),
      json(
        {
          message:
            "Invalid test-api-secret-placeholder for test-advertiser-placeholder",
        },
        400,
        { "cf-ray": "sandbox-ray-1" },
      ),
    );
    const client = new AutoTraderClient(credentials, { fetch, now: () => now });

    const error = await client.createStock({ vehicle: {} }).catch((value) => value);

    expect(error).toBeInstanceOf(AutoTraderApiError);
    expect(error.cfRay).toBe("sandbox-ray-1");
    expect(error.providerMessage).toBe("Invalid [REDACTED] for [REDACTED]");
  });
});
