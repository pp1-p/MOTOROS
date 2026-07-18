import type {
  VehicleLookupProvider,
  VehicleLookupResult,
} from "@/lib/vehicle-lookup/types";
import { VehicleLookupError } from "@/lib/vehicle-lookup/types";

type DvlaResponse = {
  registrationNumber?: string;
  taxStatus?: string;
  taxDueDate?: string;
  motStatus?: string;
  make?: string;
  yearOfManufacture?: number;
  engineCapacity?: number;
  co2Emissions?: number;
  fuelType?: string;
  markedForExport?: boolean;
  colour?: string;
  typeApproval?: string;
  euroStatus?: string;
  motExpiryDate?: string;
  monthOfFirstRegistration?: string;
};

export class DvlaVehicleLookupProvider implements VehicleLookupProvider {
  readonly name = "dvla" as const;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  async lookupByRegistration(registration: string): Promise<VehicleLookupResult> {
    let response: Response;
    try {
      response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({ registrationNumber: registration }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new VehicleLookupError(
          "timeout",
          "The DVLA service did not respond in time.",
          true,
        );
      }
      throw new VehicleLookupError(
        "provider_unavailable",
        "The DVLA service is temporarily unavailable.",
        true,
      );
    }

    if (response.status === 404) {
      throw new VehicleLookupError("not_found", "DVLA did not find that registration.");
    }
    if (response.status === 429) {
      throw new VehicleLookupError(
        "rate_limited",
        "The DVLA lookup limit has been reached. Try again shortly.",
        true,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new VehicleLookupError(
        "permission_missing",
        "DVLA rejected the configured credentials.",
      );
    }
    if (!response.ok) {
      throw new VehicleLookupError(
        "provider_unavailable",
        `DVLA lookup failed with status ${response.status}.`,
        response.status >= 500,
      );
    }

    const data = (await response.json()) as DvlaResponse;
    return {
      registration: data.registrationNumber ?? registration,
      make: data.make ?? null,
      colour: data.colour ?? null,
      fuelType: data.fuelType ?? null,
      engineCapacityCc: data.engineCapacity ?? null,
      yearOfManufacture: data.yearOfManufacture ?? null,
      monthOfFirstRegistration: data.monthOfFirstRegistration ?? null,
      taxStatus: data.taxStatus ?? null,
      taxDueDate: data.taxDueDate ?? null,
      motStatus: data.motStatus ?? null,
      motExpiryDate: data.motExpiryDate ?? null,
      co2EmissionsGKm: data.co2Emissions ?? null,
      euroStatus: data.euroStatus ?? null,
      typeApproval: data.typeApproval ?? null,
      markedForExport: data.markedForExport ?? null,
      provider: this.name,
      retrievedAt: new Date().toISOString(),
      partial: true,
      warnings: [
        "DVLA VES does not provide model, derivative, trim, gearbox, body type, doors, seats, equipment or valuation.",
        "Staff must verify the returned data before creating stock.",
      ],
    };
  }
}
