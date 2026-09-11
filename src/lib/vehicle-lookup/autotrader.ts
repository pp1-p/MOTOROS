import "server-only";

import { AutoTraderClient } from "@/lib/integrations/autotrader/client";
import { AutoTraderApiError } from "@/lib/integrations/autotrader/types";
import type {
  VehicleLookupProvider,
  VehicleLookupResult,
} from "@/lib/vehicle-lookup/types";
import { VehicleLookupError } from "@/lib/vehicle-lookup/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function warningMessages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((warning) => textValue(asRecord(warning)?.message))
    .filter((warning): warning is string => Boolean(warning));
}

function lookupError(error: unknown) {
  if (error instanceof AutoTraderApiError) {
    if (error.code === "not_found") {
      return new VehicleLookupError("not_found", "Vehicle not found.");
    }
    if (error.code === "rate_limited") {
      return new VehicleLookupError(
        "rate_limited",
        "Auto Trader temporarily rate-limited the vehicle lookup.",
        true,
      );
    }
    if (error.code === "timeout" || error.code === "service_unavailable") {
      return new VehicleLookupError(
        error.code === "timeout" ? "timeout" : "provider_unavailable",
        "Auto Trader vehicle lookup is temporarily unavailable.",
        true,
      );
    }
    if (error.code === "permission_missing") {
      return new VehicleLookupError(
        "permission_missing",
        "The configured Auto Trader agreement does not permit vehicle lookup.",
      );
    }
  }
  return new VehicleLookupError(
    "provider_unavailable",
    "Auto Trader vehicle lookup could not be completed.",
  );
}

export class AutoTraderVehicleLookupProvider implements VehicleLookupProvider {
  readonly name = "autotrader" as const;

  constructor(private readonly client: AutoTraderClient) {}

  async lookupByRegistration(registration: string): Promise<VehicleLookupResult> {
    try {
      const response = await this.client.lookupVehicleByRegistration(registration);
      const results = Array.isArray(response.data.results)
        ? response.data.results
        : [];
      const first = asRecord(results[0]);
      const vehicle = asRecord(first?.vehicle);
      if (!vehicle) {
        throw new VehicleLookupError(
          "not_found",
          "Auto Trader did not return a matching vehicle.",
        );
      }
      const make = textValue(vehicle.make);
      const fuelType = textValue(vehicle.fuelType);
      const year = textValue(vehicle.yearOfManufacture);
      const warnings = [
        ...warningMessages(response.data.warnings),
        ...warningMessages(first?.warnings),
      ].filter((warning, index, all) => all.indexOf(warning) === index);

      return {
        registration: textValue(vehicle.registration) ?? registration,
        make,
        colour: textValue(vehicle.colour),
        fuelType,
        engineCapacityCc: numberValue(vehicle.engineCapacityCC),
        yearOfManufacture: year ? Number(year) : null,
        monthOfFirstRegistration: textValue(vehicle.firstRegistrationDate),
        taxStatus: null,
        taxDueDate: null,
        motStatus: null,
        motExpiryDate: textValue(vehicle.motExpiryDate),
        co2EmissionsGKm: numberValue(vehicle.co2EmissionGPKM),
        euroStatus: textValue(vehicle.emissionClass),
        typeApproval: null,
        markedForExport: null,
        provider: "autotrader",
        retrievedAt: new Date().toISOString(),
        partial: !make || !fuelType || !year,
        warnings,
      };
    } catch (error) {
      if (error instanceof VehicleLookupError) throw error;
      throw lookupError(error);
    }
  }
}
