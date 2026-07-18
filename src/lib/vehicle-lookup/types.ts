export type VehicleLookupResult = {
  registration: string;
  make: string | null;
  colour: string | null;
  fuelType: string | null;
  engineCapacityCc: number | null;
  yearOfManufacture: number | null;
  monthOfFirstRegistration: string | null;
  taxStatus: string | null;
  taxDueDate: string | null;
  motStatus: string | null;
  motExpiryDate: string | null;
  co2EmissionsGKm: number | null;
  euroStatus: string | null;
  typeApproval: string | null;
  markedForExport: boolean | null;
  provider: "dvla" | "autotrader" | "mock";
  retrievedAt: string;
  partial: boolean;
  warnings: string[];
};

export interface VehicleLookupProvider {
  readonly name: VehicleLookupResult["provider"];
  lookupByRegistration(registration: string): Promise<VehicleLookupResult>;
}

export type VehicleLookupErrorCode =
  | "invalid_registration"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "missing_credentials"
  | "provider_unavailable"
  | "permission_missing";

export class VehicleLookupError extends Error {
  constructor(
    public readonly code: VehicleLookupErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "VehicleLookupError";
  }
}
