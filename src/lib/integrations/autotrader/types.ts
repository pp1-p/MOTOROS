export const AUTOTRADER_SANDBOX_BASE_URL =
  "https://api-sandbox.autotrader.co.uk";

export type AutoTraderJsonObject = Record<string, unknown>;

export type AutoTraderCredentials = {
  key: string;
  secret: string;
  advertiserId: string;
};

export type AutoTraderStockItem = AutoTraderJsonObject & {
  metadata?: AutoTraderJsonObject & {
    stockId?: string | null;
    externalStockId?: string | null;
    externalStockReference?: string | null;
    lifecycleState?: string | null;
    lastUpdated?: string | null;
    versionNumber?: number | null;
  };
  vehicle?: AutoTraderJsonObject & {
    registration?: string | null;
    vin?: string | null;
  };
  adverts?: AutoTraderJsonObject;
  warnings?: unknown[];
};

export type AutoTraderStockPage = {
  results: AutoTraderStockItem[];
  totalResults: number;
};

export type AutoTraderApiResponse<T> = {
  status: number;
  data: T;
  cfRay: string | null;
};

export type AutoTraderRequestMethod = "GET" | "POST" | "PATCH";

export interface AutoTraderStockClientContract {
  listAllStock(pageSize?: number): Promise<AutoTraderStockItem[]>;
  getStockById(stockId: string): Promise<AutoTraderStockItem | null>;
  createStock(
    payload: AutoTraderJsonObject,
  ): Promise<AutoTraderApiResponse<AutoTraderStockItem>>;
  updateStock(
    stockId: string,
    payload: AutoTraderJsonObject,
  ): Promise<AutoTraderApiResponse<AutoTraderStockItem>>;
}

export type AutoTraderErrorCode =
  | "authentication_failed"
  | "permission_missing"
  | "invalid_request"
  | "not_found"
  | "duplicate_stock"
  | "rate_limited"
  | "service_unavailable"
  | "timeout"
  | "invalid_response"
  | "request_failed";

export class AutoTraderApiError extends Error {
  constructor(
    message: string,
    readonly code: AutoTraderErrorCode,
    readonly status: number | null,
    readonly options: {
      retryable?: boolean;
      cfRay?: string | null;
      providerMessage?: string | null;
      existingStockId?: string | null;
    } = {},
  ) {
    super(message);
    this.name = "AutoTraderApiError";
  }

  get retryable() {
    return Boolean(this.options.retryable);
  }

  get cfRay() {
    return this.options.cfRay ?? null;
  }

  get providerMessage() {
    return this.options.providerMessage ?? null;
  }

  get existingStockId() {
    return this.options.existingStockId ?? null;
  }
}
