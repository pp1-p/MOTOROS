import "server-only";

import { getServerEnv } from "@/lib/env";
import { AutoTraderVehicleLookupProvider } from "@/lib/vehicle-lookup/autotrader";
import { DvlaVehicleLookupProvider } from "@/lib/vehicle-lookup/dvla";
import { MockVehicleLookupProvider } from "@/lib/vehicle-lookup/mock";
import type { VehicleLookupProvider } from "@/lib/vehicle-lookup/types";
import { VehicleLookupError } from "@/lib/vehicle-lookup/types";

export function getVehicleLookupProvider(): VehicleLookupProvider {
  const env = getServerEnv();

  if (env.VEHICLE_LOOKUP_PROVIDER === "mock") {
    return new MockVehicleLookupProvider();
  }

  if (env.VEHICLE_LOOKUP_PROVIDER === "dvla") {
    if (!env.DVLA_VES_API_KEY || !env.DVLA_VES_BASE_URL) {
      throw new VehicleLookupError(
        "missing_credentials",
        "DVLA lookup is selected but its API key is not configured.",
      );
    }
    return new DvlaVehicleLookupProvider(
      env.DVLA_VES_API_KEY,
      env.DVLA_VES_BASE_URL,
    );
  }

  if (env.VEHICLE_LOOKUP_PROVIDER === "autotrader") {
    if (
      !env.AUTOTRADER_CLIENT_ID ||
      !env.AUTOTRADER_CLIENT_SECRET ||
      !env.AUTOTRADER_ADVERTISER_ID ||
      !env.AUTOTRADER_API_BASE_URL
    ) {
      throw new VehicleLookupError(
        "missing_credentials",
        "Auto Trader lookup is selected but one or more credentials are missing.",
      );
    }
    return new AutoTraderVehicleLookupProvider({
      clientId: env.AUTOTRADER_CLIENT_ID,
      clientSecret: env.AUTOTRADER_CLIENT_SECRET,
      advertiserId: env.AUTOTRADER_ADVERTISER_ID,
      baseUrl: env.AUTOTRADER_API_BASE_URL,
    });
  }

  throw new VehicleLookupError(
    "provider_unavailable",
    "Vehicle lookup is set to manual entry.",
  );
}
