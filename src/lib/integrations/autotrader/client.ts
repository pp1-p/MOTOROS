import "server-only";

import { z } from "zod";

import {
  AUTOTRADER_SANDBOX_BASE_URL,
  AutoTraderApiError,
  type AutoTraderApiResponse,
  type AutoTraderCredentials,
  type AutoTraderJsonObject,
  type AutoTraderRequestMethod,
  type AutoTraderStockItem,
  type AutoTraderStockPage,
} from "@/lib/integrations/autotrader/types";

const authenticationSchema = z.object({
  access_token: z.string().min(1),
  expires_at: z.iso.datetime({ offset: true }),
});

const stockPageSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())),
  totalResults: z.number().int().nonnegative(),
});

const objectSchema = z.record(z.string(), z.unknown());

type FetchLike = typeof fetch;

type AutoTraderClientOptions = {
  fetch?: FetchLike;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
  now?: () => number;
};

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function compactProviderMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const key of ["message", "error", "detail", "title"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (Array.isArray(record.warnings)) {
    for (const warning of record.warnings) {
      const candidate = compactProviderMessage(warning);
      if (candidate) return candidate;
    }
  }
  return null;
}

function duplicateStockId(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const candidate of [
      record.stockId,
      record.existingStockId,
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>).stockId
        : null,
    ]) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  const message = compactProviderMessage(value);
  const match = message?.match(/stockId\s*=\s*([A-Za-z0-9-]+)/i);
  return match?.[1] ?? null;
}

function errorDescriptor(status: number) {
  if (status === 400) {
    return {
      code: "invalid_request" as const,
      message: "Auto Trader rejected the stock data.",
      retryable: false,
    };
  }
  if (status === 401) {
    return {
      code: "authentication_failed" as const,
      message: "Auto Trader authentication failed.",
      retryable: false,
    };
  }
  if (status === 403) {
    return {
      code: "permission_missing" as const,
      message: "Auto Trader permission is missing for this advertiser or service.",
      retryable: false,
    };
  }
  if (status === 404) {
    return {
      code: "not_found" as const,
      message: "The Auto Trader stock record was not found.",
      retryable: false,
    };
  }
  if (status === 409) {
    return {
      code: "duplicate_stock" as const,
      message: "Auto Trader reported an existing matching stock record.",
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      code: "rate_limited" as const,
      message: "Auto Trader temporarily rate-limited the request.",
      retryable: true,
    };
  }
  if (status === 503 || status === 504) {
    return {
      code: "service_unavailable" as const,
      message: "The Auto Trader sandbox service is temporarily unavailable.",
      retryable: true,
    };
  }
  return {
    code: "request_failed" as const,
    message: "The Auto Trader sandbox request failed.",
    retryable: status >= 500,
  };
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(10_000, seconds * 1000);
  }
  const base = response.status === 429 ? 1_000 : 2_000;
  return Math.min(10_000, base * 2 ** attempt);
}

export class AutoTraderClient {
  private readonly fetchFn: FetchLike;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => number;
  private token: { value: string; expiresAt: number } | null = null;
  private authenticationInFlight: Promise<string> | null = null;

  constructor(
    private readonly credentials: AutoTraderCredentials,
    options: AutoTraderClientOptions = {},
  ) {
    this.fetchFn = options.fetch ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 3);
    this.now = options.now ?? Date.now;
  }

  private redact(value: string | null) {
    if (!value) return value;
    return [
      this.credentials.key,
      this.credentials.secret,
      this.credentials.advertiserId,
      this.token?.value,
    ]
      .filter((secret): secret is string => Boolean(secret))
      .reduce(
        (redacted, secret) => redacted.replaceAll(secret, "[REDACTED]"),
        value,
      )
      .slice(0, 500);
  }

  private async readResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text.trim()) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { message: text.slice(0, 500) };
    }
  }

  private async fetchWithTimeout(url: URL, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchFn(url, {
        ...init,
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new AutoTraderApiError(
          "The Auto Trader sandbox request timed out.",
          "timeout",
          null,
          { retryable: true },
        );
      }
      throw new AutoTraderApiError(
        "The Auto Trader sandbox could not be reached.",
        "request_failed",
        null,
        { retryable: true },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async authenticateRequest() {
    const url = new URL("/authenticate", AUTOTRADER_SANDBOX_BASE_URL);
    const body = new URLSearchParams({
      key: this.credentials.key,
      secret: this.credentials.secret,
    });

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });
      } catch (error) {
        if (
          error instanceof AutoTraderApiError &&
          error.retryable &&
          attempt + 1 < this.maxAttempts
        ) {
          await this.sleep(Math.min(10_000, 2_000 * 2 ** attempt));
          continue;
        }
        throw error;
      }

      const payload = await this.readResponse(response);
      if (response.ok) {
        const parsed = authenticationSchema.safeParse(payload);
        if (!parsed.success) {
          throw new AutoTraderApiError(
            "Auto Trader returned an invalid authentication response.",
            "invalid_response",
            response.status,
            { cfRay: response.headers.get("cf-ray") },
          );
        }
        const expiresAt = Date.parse(parsed.data.expires_at);
        this.token = { value: parsed.data.access_token, expiresAt };
        return parsed.data.access_token;
      }

      const descriptor = errorDescriptor(response.status);
      if (
        descriptor.retryable &&
        attempt + 1 < this.maxAttempts
      ) {
        await this.sleep(retryDelay(response, attempt));
        continue;
      }
      throw new AutoTraderApiError(
        descriptor.message,
        descriptor.code,
        response.status,
        {
          retryable: descriptor.retryable,
          cfRay: response.headers.get("cf-ray"),
          providerMessage: this.redact(compactProviderMessage(payload)),
        },
      );
    }

    throw new AutoTraderApiError(
      "Auto Trader authentication could not be completed.",
      "authentication_failed",
      null,
    );
  }

  async authenticate() {
    if (this.token && this.token.expiresAt - 30_000 > this.now()) {
      return this.token.value;
    }
    if (!this.authenticationInFlight) {
      this.authenticationInFlight = this.authenticateRequest().finally(() => {
        this.authenticationInFlight = null;
      });
    }
    return this.authenticationInFlight;
  }

  private async request<T>(input: {
    method: AutoTraderRequestMethod;
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: AutoTraderJsonObject;
    parse: (value: unknown) => T;
  }): Promise<AutoTraderApiResponse<T>> {
    const retryableMethod = input.method === "GET" || input.method === "PATCH";
    let refreshedAuthentication = false;

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const token = await this.authenticate();
      const url = new URL(input.path, AUTOTRADER_SANDBOX_BASE_URL);
      for (const [key, value] of Object.entries({
        advertiserId: this.credentials.advertiserId,
        ...input.query,
      })) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }

      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, {
          method: input.method,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...(input.body ? { "Content-Type": "application/json" } : {}),
          },
          body: input.body ? JSON.stringify(input.body) : undefined,
        });
      } catch (error) {
        if (
          retryableMethod &&
          error instanceof AutoTraderApiError &&
          error.retryable &&
          attempt + 1 < this.maxAttempts
        ) {
          await this.sleep(Math.min(10_000, 2_000 * 2 ** attempt));
          continue;
        }
        throw error;
      }

      const payload = await this.readResponse(response);
      if (response.ok) {
        let data: T;
        try {
          data = input.parse(payload);
        } catch {
          throw new AutoTraderApiError(
            "Auto Trader returned an invalid API response.",
            "invalid_response",
            response.status,
            { cfRay: response.headers.get("cf-ray") },
          );
        }
        return {
          status: response.status,
          data,
          cfRay: response.headers.get("cf-ray"),
        };
      }

      if (
        response.status === 401 &&
        retryableMethod &&
        !refreshedAuthentication
      ) {
        this.token = null;
        refreshedAuthentication = true;
        continue;
      }

      const descriptor = errorDescriptor(response.status);
      if (
        retryableMethod &&
        descriptor.retryable &&
        attempt + 1 < this.maxAttempts
      ) {
        await this.sleep(retryDelay(response, attempt));
        continue;
      }

      throw new AutoTraderApiError(
        descriptor.message,
        descriptor.code,
        response.status,
        {
          retryable: retryableMethod && descriptor.retryable,
          cfRay: response.headers.get("cf-ray"),
          providerMessage: this.redact(compactProviderMessage(payload)),
          existingStockId:
            response.status === 409 ? duplicateStockId(payload) : null,
        },
      );
    }

    throw new AutoTraderApiError(
      "The Auto Trader sandbox request exhausted its retry limit.",
      "request_failed",
      null,
    );
  }

  async listStockPage(input: { page: number; pageSize: number }) {
    return this.request<AutoTraderStockPage>({
      method: "GET",
      path: "/stock",
      query: {
        page: input.page,
        pageSize: input.pageSize,
      },
      parse(value) {
        const parsed = stockPageSchema.parse(value);
        return {
          results: parsed.results as AutoTraderStockItem[],
          totalResults: parsed.totalResults,
        };
      },
    });
  }

  async listAllStock(pageSize = 20) {
    const safePageSize = Math.min(200, Math.max(1, pageSize));
    const results: AutoTraderStockItem[] = [];
    let page = 1;
    let totalResults = 0;

    do {
      const response = await this.listStockPage({ page, pageSize: safePageSize });
      if (
        response.data.results.length === 0 &&
        results.length < response.data.totalResults
      ) {
        throw new AutoTraderApiError(
          "Auto Trader pagination ended before all stock records were returned.",
          "invalid_response",
          response.status,
          { cfRay: response.cfRay },
        );
      }
      results.push(...response.data.results);
      totalResults = response.data.totalResults;
      page += 1;
    } while (results.length < totalResults);

    return results;
  }

  async getStockById(stockId: string) {
    const response = await this.request<AutoTraderStockPage>({
      method: "GET",
      path: "/stock",
      query: { stockId, page: 1, pageSize: 1 },
      parse(value) {
        const parsed = stockPageSchema.parse(value);
        return {
          results: parsed.results as AutoTraderStockItem[],
          totalResults: parsed.totalResults,
        };
      },
    });
    return response.data.results[0] ?? null;
  }

  async lookupVehicleByRegistration(registration: string) {
    return this.request<AutoTraderJsonObject>({
      method: "GET",
      path: "/vehicles",
      query: { registration },
      parse(value) {
        return objectSchema.parse(value);
      },
    });
  }

  async verifyConnection() {
    await this.authenticate();
    const page = await this.listStockPage({ page: 1, pageSize: 1 });
    return { totalResults: page.data.totalResults, cfRay: page.cfRay };
  }

  async createStock(payload: AutoTraderJsonObject) {
    return this.request<AutoTraderStockItem>({
      method: "POST",
      path: "/stock",
      body: payload,
      parse(value) {
        return objectSchema.parse(value) as AutoTraderStockItem;
      },
    });
  }

  async updateStock(stockId: string, payload: AutoTraderJsonObject) {
    return this.request<AutoTraderStockItem>({
      method: "PATCH",
      path: `/stock/${encodeURIComponent(stockId)}`,
      body: payload,
      parse(value) {
        return objectSchema.parse(value) as AutoTraderStockItem;
      },
    });
  }
}
