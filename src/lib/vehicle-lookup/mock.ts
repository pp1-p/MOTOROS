import type {
  VehicleLookupProvider,
  VehicleLookupResult,
} from "@/lib/vehicle-lookup/types";
import { VehicleLookupError } from "@/lib/vehicle-lookup/types";

const fixtures: Record<
  string,
  Omit<VehicleLookupResult, "registration" | "provider" | "retrievedAt">
> = {
  DE24LER: {
    make: "VOLVO",
    colour: "GREY",
    fuelType: "PETROL",
    engineCapacityCc: 1969,
    yearOfManufacture: 2024,
    monthOfFirstRegistration: "2024-06",
    taxStatus: "Taxed",
    taxDueDate: "2027-06-01",
    motStatus: "No details held by DVLA",
    motExpiryDate: null,
    co2EmissionsGKm: 154,
    euroStatus: "EURO 6",
    typeApproval: "M1",
    markedForExport: false,
    partial: true,
    warnings: [
      "Mock development record.",
      "Model, derivative, gearbox and equipment require staff confirmation.",
    ],
  },
  AB12CDE: {
    make: "FORD",
    colour: "BLUE",
    fuelType: "DIESEL",
    engineCapacityCc: 1997,
    yearOfManufacture: 2012,
    monthOfFirstRegistration: "2012-03",
    taxStatus: "Taxed",
    taxDueDate: "2027-03-01",
    motStatus: "Valid",
    motExpiryDate: "2027-02-12",
    co2EmissionsGKm: 129,
    euroStatus: "EURO 5",
    typeApproval: "M1",
    markedForExport: false,
    partial: true,
    warnings: [
      "Mock development record.",
      "Confirm all details against the V5C and vehicle before advertising.",
    ],
  },
  XY68XYZ: {
    make: "BMW",
    colour: "BLACK",
    fuelType: "PETROL",
    engineCapacityCc: 1998,
    yearOfManufacture: 2018,
    monthOfFirstRegistration: "2018-11",
    taxStatus: "SORN",
    taxDueDate: null,
    motStatus: "Expired",
    motExpiryDate: "2025-10-30",
    co2EmissionsGKm: 136,
    euroStatus: "EURO 6",
    typeApproval: "M1",
    markedForExport: false,
    partial: true,
    warnings: ["Mock development record.", "MOT is shown as expired in this fixture."],
  },
};

export class MockVehicleLookupProvider implements VehicleLookupProvider {
  readonly name = "mock" as const;

  async lookupByRegistration(registration: string): Promise<VehicleLookupResult> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const fixture = fixtures[registration];
    if (!fixture) {
      throw new VehicleLookupError(
        "not_found",
        "This registration is not in the mock provider. Use DE24 LER, AB12 CDE or XY68 XYZ, or continue with manual entry.",
      );
    }

    return {
      registration,
      provider: this.name,
      retrievedAt: new Date().toISOString(),
      ...fixture,
    };
  }
}
