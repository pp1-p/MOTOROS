import type {
  VehicleLookupProvider,
  VehicleLookupResult,
} from "@/lib/vehicle-lookup/types";
import { VehicleLookupError } from "@/lib/vehicle-lookup/types";

/**
 * Auto Trader Connect products and endpoint permissions are contract-specific.
 * This adapter deliberately refuses to guess an endpoint. The dealership's
 * authorised endpoint mapping can be injected here after onboarding.
 */
export class AutoTraderVehicleLookupProvider implements VehicleLookupProvider {
  readonly name = "autotrader" as const;

  constructor(
    private readonly configuration: {
      clientId: string;
      clientSecret: string;
      advertiserId: string;
      baseUrl: string;
    },
  ) {}

  async lookupByRegistration(registration: string): Promise<VehicleLookupResult> {
    void this.configuration;
    void registration;
    throw new VehicleLookupError(
      "permission_missing",
      "Auto Trader credentials are present, but the authorised taxonomy endpoint must be mapped from the dealership's Connect agreement before lookup can be enabled.",
    );
  }
}
