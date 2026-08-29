import { describe, expect, it, vi } from "vitest";

import {
  planAutoTraderVehicle,
  type LocalAutoTraderVehicle,
} from "./mapping";
import { validAutoTraderVehicle } from "@/test/autotrader-fixtures";
import {
  syncAutoTraderStock,
  type AutoTraderSyncStore,
  type PersistedAutoTraderState,
} from "./sync";
import {
  AutoTraderApiError,
  type AutoTraderStockClientContract,
  type AutoTraderStockItem,
} from "./types";

function remoteFor(
  vehicle: LocalAutoTraderVehicle,
  stockId = `remote-${vehicle.stockNumber}`,
): AutoTraderStockItem {
  const payload = structuredClone(
    planAutoTraderVehicle(vehicle).payload ?? {},
  ) as AutoTraderStockItem;
  payload.metadata = {
    ...payload.metadata,
    stockId,
    lastUpdated: "2026-08-28T10:00:00Z",
    versionNumber: 1,
  };
  return payload;
}

function response(data: AutoTraderStockItem, status = 200) {
  return { status, data, cfRay: null };
}

class MemoryStore implements AutoTraderSyncStore {
  readonly completed: Array<Record<string, unknown>> = [];
  readonly persisted: PersistedAutoTraderState[] = [];
  readonly failures: Array<Record<string, unknown>> = [];
  private nextRecord = 0;

  constructor(readonly vehicles: LocalAutoTraderVehicle[]) {}

  async listVehicles(input: { organisationId: string; vehicleId?: string }) {
    return this.vehicles.filter(
      (vehicle) =>
        vehicle.organisationId === input.organisationId &&
        (!input.vehicleId || vehicle.id === input.vehicleId),
    );
  }

  async beginRecord() {
    this.nextRecord += 1;
    return `record-${this.nextRecord}`;
  }

  async completeRecord(input: Record<string, unknown>) {
    this.completed.push(input);
  }

  async persistVehicleState(input: PersistedAutoTraderState) {
    this.persisted.push(input);
  }

  async markVehicleFailure(input: Record<string, unknown>) {
    this.failures.push(input);
  }
}

function client(overrides: Partial<AutoTraderStockClientContract> = {}) {
  return {
    listAllStock: vi.fn().mockResolvedValue([]),
    getStockById: vi.fn().mockResolvedValue(null),
    createStock: vi.fn(),
    updateStock: vi.fn(),
    ...overrides,
  } as AutoTraderStockClientContract & {
    listAllStock: ReturnType<typeof vi.fn>;
    getStockById: ReturnType<typeof vi.fn>;
    createStock: ReturnType<typeof vi.fn>;
    updateStock: ReturnType<typeof vi.fn>;
  };
}

describe("syncAutoTraderStock", () => {
  it("creates once, stores the remote ID and is unchanged on rerun", async () => {
    const vehicle = validAutoTraderVehicle();
    const remote = remoteFor(vehicle, "remote-stock-1");
    const store = new MemoryStore([vehicle]);
    const api = client({
      listAllStock: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([remote]),
      createStock: vi.fn().mockResolvedValue(response(remote, 201)),
    });

    const first = await syncAutoTraderStock({
      organisationId: vehicle.organisationId,
      client: api,
      store,
    });
    const second = await syncAutoTraderStock({
      organisationId: vehicle.organisationId,
      client: api,
      store,
    });

    expect(first).toMatchObject({ created: 1, failed: 0 });
    expect(second).toMatchObject({ unchanged: 1, created: 0 });
    expect(api.createStock).toHaveBeenCalledTimes(1);
    expect(store.persisted[0]).toMatchObject({
      vehicleId: vehicle.id,
      externalStockId: "remote-stock-1",
    });
  });

  it("uses the 409 stock ID instead of retrying a duplicate create", async () => {
    const vehicle = validAutoTraderVehicle();
    const remote = remoteFor(vehicle, "existing-stock-7");
    const duplicate = new AutoTraderApiError(
      "Auto Trader reported an existing matching stock record.",
      "duplicate_stock",
      409,
      { existingStockId: "existing-stock-7" },
    );
    const api = client({
      createStock: vi.fn().mockRejectedValue(duplicate),
      getStockById: vi.fn().mockResolvedValue(remote),
      updateStock: vi.fn().mockResolvedValue(response({}, 202)),
    });

    const result = await syncAutoTraderStock({
      organisationId: vehicle.organisationId,
      client: api,
      store: new MemoryStore([vehicle]),
    });

    expect(result).toMatchObject({ unchanged: 1, failed: 0 });
    expect(api.createStock).toHaveBeenCalledTimes(1);
    expect(api.getStockById).toHaveBeenCalledWith("existing-stock-7");
  });

  it("isolates invalid vehicles and continues syncing valid stock", async () => {
    const invalid = validAutoTraderVehicle({ retailPrice: 50 });
    const valid = validAutoTraderVehicle({
      id: "33333333-3333-4333-8333-333333333333",
      registration: "CD34 EFG",
      vin: "WVWZZZ1JZXW000002",
      stockNumber: "STOCK-002",
    });
    const api = client({
      createStock: vi.fn().mockResolvedValue(response(remoteFor(valid), 201)),
    });

    const result = await syncAutoTraderStock({
      organisationId: valid.organisationId,
      client: api,
      store: new MemoryStore([invalid, valid]),
    });

    expect(result).toMatchObject({ total: 2, created: 1, skipped: 1, failed: 0 });
    expect(api.createStock).toHaveBeenCalledTimes(1);
    expect(result.items[0]?.message).toContain("at least £75");
  });

  it("unpublishes every retail destination before marking stock sold", async () => {
    const vehicle = validAutoTraderVehicle({
      status: "sold",
      soldAt: "2026-08-28",
      actualSalePrice: 15_000,
      autotraderStockId: "remote-stock-sold",
    });
    const activeVehicle = validAutoTraderVehicle();
    const remote = remoteFor(activeVehicle, "remote-stock-sold");
    remote.adverts = {
      ...(remote.adverts ?? {}),
      retailAdverts: {
        ...((remote.adverts?.retailAdverts as Record<string, unknown>) ?? {}),
        autotraderAdvert: { status: "PUBLISHED" },
        advertiserAdvert: { status: "PUBLISHED" },
        locatorAdvert: { status: "PUBLISHED" },
        exportAdvert: { status: "PUBLISHED" },
        profileAdvert: { status: "PUBLISHED" },
      },
    };
    const api = client({
      listAllStock: vi.fn().mockResolvedValue([remote]),
      updateStock: vi.fn().mockResolvedValue(response({}, 202)),
    });

    const result = await syncAutoTraderStock({
      organisationId: vehicle.organisationId,
      client: api,
      store: new MemoryStore([vehicle]),
    });

    expect(result.updated).toBe(1);
    expect(api.updateStock).toHaveBeenCalledTimes(2);
    expect(api.updateStock.mock.calls[0]?.[1]).toMatchObject({
      adverts: {
        retailAdverts: {
          autotraderAdvert: { status: "NOT_PUBLISHED" },
          advertiserAdvert: { status: "NOT_PUBLISHED" },
          locatorAdvert: { status: "NOT_PUBLISHED" },
          exportAdvert: { status: "NOT_PUBLISHED" },
          profileAdvert: { status: "NOT_PUBLISHED" },
        },
      },
    });
    expect(api.updateStock.mock.calls[1]?.[1]).toMatchObject({
      metadata: { lifecycleState: "SOLD" },
      adverts: { soldDate: "2026-08-28", soldPrice: { amountGBP: 15_000 } },
    });
  });

  it("continues after a non-transient API error and reports each outcome", async () => {
    const first = validAutoTraderVehicle();
    const second = validAutoTraderVehicle({
      id: "33333333-3333-4333-8333-333333333333",
      registration: "CD34 EFG",
      vin: "WVWZZZ1JZXW000002",
      stockNumber: "STOCK-002",
    });
    const store = new MemoryStore([first, second]);
    const api = client({
      createStock: vi
        .fn()
        .mockRejectedValueOnce(
          new AutoTraderApiError(
            "Auto Trader rejected the stock data.",
            "invalid_request",
            400,
          ),
        )
        .mockResolvedValueOnce(response(remoteFor(second), 201)),
    });

    const result = await syncAutoTraderStock({
      organisationId: first.organisationId,
      client: api,
      store,
    });

    expect(result).toMatchObject({ total: 2, created: 1, failed: 1, halted: false });
    expect(store.failures).toHaveLength(1);
  });

  it("halts the advertiser batch after an authentication baseline failure", async () => {
    const vehicle = validAutoTraderVehicle();
    const api = client({
      listAllStock: vi.fn().mockRejectedValue(
        new AutoTraderApiError(
          "Auto Trader authentication failed.",
          "authentication_failed",
          401,
        ),
      ),
    });

    const result = await syncAutoTraderStock({
      organisationId: vehicle.organisationId,
      client: api,
      store: new MemoryStore([vehicle]),
    });

    expect(result).toMatchObject({ halted: true, failed: 1 });
    expect(api.createStock).not.toHaveBeenCalled();
  });
});
