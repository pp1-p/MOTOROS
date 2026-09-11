import { createHash } from "node:crypto";

import { z } from "zod";

import type {
  AutoTraderJsonObject,
  AutoTraderStockItem,
} from "@/lib/integrations/autotrader/types";

const activeChannelStatuses = new Set(["ready", "published"]);
const serviceHistoryValues = new Set([
  "Full service history",
  "Full dealership history",
  "Part service history",
  "No service history",
]);

const localVehicleSchema = z.object({
  id: z.uuid(),
  organisationId: z.uuid(),
  registration: z.string().trim().min(2).max(12).nullable(),
  vin: z.string().trim().max(32).nullable(),
  stockNumber: z.string().trim().min(1).max(80),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(100),
  derivative: z.string().trim().max(160).nullable(),
  trim: z.string().trim().max(120).nullable(),
  bodyType: z.string().trim().max(80).nullable(),
  fuelType: z.string().trim().min(1).max(80),
  transmission: z.string().trim().min(1).max(80),
  colour: z.string().trim().max(80).nullable(),
  doors: z.number().int().min(1).max(8).nullable(),
  seats: z.number().int().min(1).max(20).nullable(),
  engineSizeCc: z.number().int().min(1).max(20_000).nullable(),
  powerBhp: z.number().int().min(1).max(3_000).nullable(),
  co2EmissionsGKm: z.number().int().min(0).max(2_000).nullable(),
  euroEmissionsStandard: z.string().trim().max(40).nullable(),
  year: z.number().int().min(1886).max(2200),
  firstRegistrationDate: z.iso.date().nullable(),
  motExpiry: z.iso.date().nullable(),
  previousOwners: z.number().int().min(0).max(99).nullable(),
  mileage: z.number().int().min(0).max(2_000_000),
  serviceHistory: z.string().trim().max(200).nullable(),
  keys: z.number().int().min(0).max(20).nullable(),
  retailPrice: z.number().min(0).max(20_000_000).nullable(),
  actualSalePrice: z.number().min(0).max(20_000_000).nullable(),
  soldAt: z.iso.date().nullable(),
  attentionGrabber: z.string().trim().max(220).nullable(),
  description: z.string().trim().max(20_000).nullable(),
  standardEquipment: z.array(z.string().trim().min(1).max(160)).max(200),
  optionalEquipment: z.array(z.string().trim().min(1).max(160)).max(200),
  features: z.array(z.string().trim().min(1).max(160)).max(200),
  videoUrl: z.url().nullable(),
  interiorColour: z.string().trim().max(80).nullable(),
  interiorMaterial: z.string().trim().max(120).nullable(),
  fuelConsumptionUrbanMpg: z.number().min(0).max(1_000).nullable(),
  fuelConsumptionExtraUrbanMpg: z.number().min(0).max(1_000).nullable(),
  fuelConsumptionCombinedMpg: z.number().min(0).max(1_000).nullable(),
  wheelchairAccessible: z.boolean().nullable(),
  acceleration060Seconds: z.number().min(0).max(1_000).nullable(),
  topSpeedMph: z.number().int().min(0).max(1_000).nullable(),
  engineNumber: z.string().trim().max(120).nullable(),
  cylinderCount: z.number().int().min(1).max(32).nullable(),
  driveType: z.string().trim().max(80).nullable(),
  grossWeightKg: z.number().int().min(0).max(100_000).nullable(),
  lengthMm: z.number().int().min(0).max(100_000).nullable(),
  widthMm: z.number().int().min(0).max(100_000).nullable(),
  plate: z.string().trim().max(40).nullable(),
  advertisedCondition: z.enum([
    "new",
    "used",
    "demonstrator",
    "pre_registered",
  ]),
  status: z.string().min(1),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
  autotraderStockId: z.string().trim().min(1).max(200).nullable(),
  channel: z
    .object({
      status: z.string().min(1),
      externalStockId: z.string().trim().min(1).max(200).nullable(),
      externalDerivativeId: z.string().trim().min(1).max(200).nullable(),
      metadata: z.record(z.string(), z.unknown()),
    })
    .nullable(),
});

export type LocalAutoTraderVehicle = z.infer<typeof localVehicleSchema>;

export type AutoTraderVehicleIntent =
  | "upsert"
  | "pause"
  | "sold"
  | "withdraw"
  | "skip";

export type AutoTraderVehiclePlan = {
  vehicle: LocalAutoTraderVehicle;
  intent: AutoTraderVehicleIntent;
  payload: AutoTraderJsonObject | null;
  payloadHash: string | null;
  warnings: string[];
  skipReason: string | null;
};

function assignDefined(
  target: AutoTraderJsonObject,
  values: Record<string, unknown>,
) {
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== "") {
      target[key] = value;
    }
  }
}

function normaliseRegistration(value: string | null) {
  return value?.replace(/\s+/g, "").toUpperCase() ?? null;
}

function isSupportedVideoUrl(value: string) {
  const hostname = new URL(value).hostname.toLowerCase();
  return (
    hostname === "youtu.be" ||
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "vimeo.com" ||
    hostname.endsWith(".vimeo.com")
  );
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function hashAutoTraderPayload(value: AutoTraderJsonObject) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function lifecycleForStatus(status: string) {
  if (status === "due_in") return "DUE_IN";
  if (status === "reserved" || status === "sale_in_progress") {
    return "SALE_IN_PROGRESS";
  }
  return "FORECOURT";
}

function featurePayload(vehicle: LocalAutoTraderVehicle) {
  const rows: Array<{ name: string; type: "Standard" | "Optional" }> = [];
  const seen = new Set<string>();
  const add = (name: string, type: "Standard" | "Optional") => {
    const key = `${type}:${name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ name, type });
  };

  for (const name of vehicle.standardEquipment) add(name, "Standard");
  for (const name of vehicle.optionalEquipment) add(name, "Optional");
  if (rows.length === 0) {
    for (const name of vehicle.features) add(name, "Standard");
  }
  return rows;
}

function activeStockPayload(
  vehicle: LocalAutoTraderVehicle,
  warnings: string[],
) {
  const registration = normaliseRegistration(vehicle.registration);
  const vehiclePayload: AutoTraderJsonObject = {
    registration,
    make: vehicle.make,
    model: vehicle.model,
    vehicleType: "Car",
    fuelType: vehicle.fuelType,
    transmissionType: vehicle.transmission,
    yearOfManufacture: String(vehicle.year),
    odometerReadingMiles: vehicle.mileage,
  };
  assignDefined(vehiclePayload, {
    vin: vehicle.vin?.toUpperCase(),
    engineNumber: vehicle.engineNumber,
    derivative: vehicle.derivative,
    derivativeId: vehicle.channel?.externalDerivativeId,
    trim: vehicle.trim,
    bodyType: vehicle.bodyType,
    drivetrain: vehicle.driveType,
    seats: vehicle.seats,
    doors: vehicle.doors,
    cylinders: vehicle.cylinderCount,
    co2EmissionGPKM: vehicle.co2EmissionsGKm,
    topSpeedMPH: vehicle.topSpeedMph,
    zeroToSixtyMPHSeconds: vehicle.acceleration060Seconds,
    engineCapacityCC: vehicle.engineSizeCc,
    enginePowerBHP: vehicle.powerBhp,
    owners:
      vehicle.previousOwners === null ? null : vehicle.previousOwners + 1,
    fuelEconomyNEDCExtraUrbanMPG: vehicle.fuelConsumptionExtraUrbanMpg,
    fuelEconomyNEDCUrbanMPG: vehicle.fuelConsumptionUrbanMpg,
    fuelEconomyNEDCCombinedMPG: vehicle.fuelConsumptionCombinedMpg,
    firstRegistrationDate: vehicle.firstRegistrationDate,
    colour: vehicle.colour,
    lengthMM: vehicle.lengthMm,
    widthMM: vehicle.widthMm,
    grossVehicleWeightKG: vehicle.grossWeightKg,
    motExpiryDate: vehicle.motExpiry,
    serviceHistory:
      vehicle.serviceHistory && serviceHistoryValues.has(vehicle.serviceHistory)
        ? vehicle.serviceHistory
        : null,
    plate: vehicle.plate,
    interiorColour: vehicle.interiorColour,
    upholstery: vehicle.interiorMaterial,
    emissionClass: vehicle.euroEmissionsStandard,
    keys: vehicle.keys,
    wheelchairAccessible: vehicle.wheelchairAccessible,
  });

  if (
    vehicle.serviceHistory &&
    !serviceHistoryValues.has(vehicle.serviceHistory)
  ) {
    warnings.push(
      "Service history was omitted because it does not match an Auto Trader accepted value.",
    );
  }

  const suppliedPrice = vehicle.retailPrice!;
  const retailAdverts: AutoTraderJsonObject = {
    suppliedPrice: { amountGBP: suppliedPrice },
    attentionGrabber: vehicle.attentionGrabber,
    description: vehicle.description,
    autotraderAdvert: {
      status:
        vehicle.channel?.status === "published"
          ? "PUBLISHED"
          : "NOT_PUBLISHED",
    },
  };
  const payload: AutoTraderJsonObject = {
    vehicle: vehiclePayload,
    adverts: {
      forecourtPrice: { amountGBP: suppliedPrice },
      reservationStatus:
        vehicle.status === "reserved" ? "Reserved" : null,
      retailAdverts,
    },
    metadata: {
      externalStockId: vehicle.id,
      externalStockReference:
        vehicle.stockNumber.length <= 25 ? vehicle.stockNumber : null,
      lifecycleState: lifecycleForStatus(vehicle.status),
    },
    features: featurePayload(vehicle),
  };

  if (vehicle.stockNumber.length > 25) {
    warnings.push(
      "The local stock number was omitted because Auto Trader externalStockReference is limited to 25 characters.",
    );
  }
  if (!vehicle.channel?.externalDerivativeId) {
    warnings.push(
      "No Auto Trader derivative ID is stored; specification, valuation and price-indicator data may be incomplete.",
    );
  }
  if (!vehicle.videoUrl) {
    payload.media = { video: { href: null } };
  } else {
    if (isSupportedVideoUrl(vehicle.videoUrl)) {
      payload.media = { video: { href: vehicle.videoUrl } };
    } else {
      warnings.push(
        "The video URL was omitted because it is not hosted by YouTube or Vimeo.",
      );
    }
  }

  return payload;
}

function validationMessages(vehicle: LocalAutoTraderVehicle) {
  const failures: string[] = [];
  const registration = normaliseRegistration(vehicle.registration);
  if (!registration || registration.length < 2 || registration.length > 7) {
    failures.push("A valid 2–7 character registration is required.");
  }
  if (vehicle.advertisedCondition === "new") {
    failures.push(
      "New unregistered stock is not supported by the current MOTOR.OS vehicle model; use used stock or extend the registration workflow first.",
    );
  }
  if (vehicle.derivative && vehicle.derivative.length > 150) {
    failures.push("Derivative must be 150 characters or fewer.");
  }
  if (vehicle.attentionGrabber && vehicle.attentionGrabber.length > 30) {
    failures.push("Attention grabber must be 30 characters or fewer.");
  }
  if (vehicle.description && vehicle.description.length > 4_000) {
    failures.push("Description must be 4,000 characters or fewer.");
  }
  if (vehicle.retailPrice === null || vehicle.retailPrice < 75) {
    failures.push("A stock price of at least £75 is required.");
  }
  if (vehicle.vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vehicle.vin.toUpperCase())) {
    failures.push("VIN must be a valid 17-character VIN when supplied.");
  }
  return failures;
}

export function parseLocalAutoTraderVehicle(value: unknown) {
  return localVehicleSchema.parse(value);
}

export function planAutoTraderVehicle(value: unknown): AutoTraderVehiclePlan {
  const vehicle = parseLocalAutoTraderVehicle(value);
  const warnings: string[] = [];
  const channelStatus = vehicle.channel?.status ?? "not_configured";

  let intent: AutoTraderVehicleIntent;
  if (
    vehicle.deletedAt ||
    vehicle.status === "returned" ||
    vehicle.status === "archived" ||
    channelStatus === "removed"
  ) {
    intent = "withdraw";
  } else if (vehicle.status === "sold") {
    intent = "sold";
  } else if (channelStatus === "paused") {
    intent = "pause";
  } else if (activeChannelStatuses.has(channelStatus)) {
    intent = "upsert";
  } else {
    intent = "skip";
  }

  if (intent === "skip") {
    return {
      vehicle,
      intent,
      payload: null,
      payloadHash: null,
      warnings,
      skipReason:
        "Set the vehicle's Auto Trader channel to ready or published before syncing.",
    };
  }

  if (intent === "pause" || intent === "sold" || intent === "withdraw") {
    const payload =
      intent === "pause"
        ? autoTraderPausePayload()
        : intent === "sold"
          ? autoTraderSoldPayload(vehicle)
          : autoTraderWithdrawPayload();
    return {
      vehicle,
      intent,
      payload,
      payloadHash: hashAutoTraderPayload(payload),
      warnings,
      skipReason: null,
    };
  }

  const failures = validationMessages(vehicle);
  if (failures.length > 0) {
    return {
      vehicle,
      intent: "skip",
      payload: null,
      payloadHash: null,
      warnings,
      skipReason: failures.join(" "),
    };
  }

  const payload = activeStockPayload(vehicle, warnings);
  return {
    vehicle,
    intent,
    payload,
    payloadHash: hashAutoTraderPayload(payload),
    warnings,
    skipReason: null,
  };
}

export function autoTraderUnpublishAllPayload(): AutoTraderJsonObject {
  return {
    adverts: {
      retailAdverts: {
        autotraderAdvert: { status: "NOT_PUBLISHED" },
        advertiserAdvert: { status: "NOT_PUBLISHED" },
        locatorAdvert: { status: "NOT_PUBLISHED" },
        exportAdvert: { status: "NOT_PUBLISHED" },
        profileAdvert: { status: "NOT_PUBLISHED" },
      },
    },
  };
}

export function autoTraderPausePayload(): AutoTraderJsonObject {
  return {
    adverts: {
      retailAdverts: {
        autotraderAdvert: { status: "NOT_PUBLISHED" },
      },
    },
  };
}

export function autoTraderSoldPayload(
  vehicle: Pick<LocalAutoTraderVehicle, "soldAt" | "actualSalePrice">,
): AutoTraderJsonObject {
  const adverts: AutoTraderJsonObject = {};
  assignDefined(adverts, {
    soldDate: vehicle.soldAt,
    soldPrice:
      vehicle.actualSalePrice === null
        ? null
        : { amountGBP: vehicle.actualSalePrice },
  });
  return {
    metadata: { lifecycleState: "SOLD" },
    ...(Object.keys(adverts).length > 0 ? { adverts } : {}),
  };
}

export function autoTraderWithdrawPayload(): AutoTraderJsonObject {
  return { metadata: { lifecycleState: "WASTEBIN" } };
}

function asRecord(value: unknown): AutoTraderJsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as AutoTraderJsonObject)
    : null;
}

export function autoTraderStockId(item: AutoTraderStockItem | null) {
  const value = asRecord(item?.metadata)?.stockId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function autoTraderExternalStockId(item: AutoTraderStockItem) {
  const value = asRecord(item.metadata)?.externalStockId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function autoTraderRegistration(item: AutoTraderStockItem) {
  const value = asRecord(item.vehicle)?.registration;
  return typeof value === "string" ? normaliseRegistration(value) : null;
}

export function autoTraderVin(item: AutoTraderStockItem) {
  const value = asRecord(item.vehicle)?.vin;
  return typeof value === "string" && value.trim()
    ? value.trim().toUpperCase()
    : null;
}

export function autoTraderLifecycle(item: AutoTraderStockItem) {
  const value = asRecord(item.metadata)?.lifecycleState;
  return typeof value === "string" ? value : null;
}

export function autoTraderAdvertStatus(item: AutoTraderStockItem) {
  const adverts = asRecord(item.adverts);
  const retailAdverts = asRecord(adverts?.retailAdverts);
  const advert = asRecord(retailAdverts?.autotraderAdvert);
  return typeof advert?.status === "string" ? advert.status : null;
}

export function autoTraderProviderWarnings(item: AutoTraderStockItem) {
  const warnings = Array.isArray(item.warnings) ? item.warnings : [];
  return warnings
    .map((warning) => {
      if (typeof warning === "string") return warning;
      const record = asRecord(warning);
      return typeof record?.message === "string" ? record.message : null;
    })
    .filter((warning): warning is string => Boolean(warning))
    .map((warning) => warning.slice(0, 500));
}
