import { describe, expect, it, vi } from "vitest";

import type { AutoTraderClient } from "@/lib/integrations/autotrader/client";

import { AutoTraderVehicleLookupProvider } from "./autotrader";

function fakeClient(data: Record<string, unknown>) {
  return {
    lookupVehicleByRegistration: vi.fn().mockResolvedValue({ data }),
  } as unknown as AutoTraderClient;
}

describe("Auto Trader vehicle lookup", () => {
  it("reads the current results.vehicle response shape", async () => {
    const provider = new AutoTraderVehicleLookupProvider(
      fakeClient({
        results: [
          {
            vehicle: {
              registration: "AB12CDE",
              make: "Volkswagen",
              fuelType: "Petrol",
              yearOfManufacture: "2020",
              engineCapacityCC: 1498,
            },
          },
        ],
        totalResults: 1,
      }),
    );

    const result = await provider.lookupByRegistration("AB12CDE");

    expect(result.registration).toBe("AB12CDE");
    expect(result.make).toBe("Volkswagen");
    expect(result.engineCapacityCc).toBe(1498);
    expect(result.partial).toBe(false);
  });

  it("combines service-level and record-level warnings without duplicates", async () => {
    const provider = new AutoTraderVehicleLookupProvider(
      fakeClient({
        warnings: [{ message: "Service warning" }],
        results: [
          {
            vehicle: {
              registration: "AB12CDE",
              make: "Volkswagen",
              fuelType: "Petrol",
              yearOfManufacture: "2020",
            },
            warnings: [
              { message: "Vehicle-specific warning" },
              { message: "Service warning" },
            ],
          },
        ],
        totalResults: 1,
      }),
    );

    const result = await provider.lookupByRegistration("AB12CDE");

    expect(result.warnings).toEqual([
      "Service warning",
      "Vehicle-specific warning",
    ]);
  });
});
