import "server-only";

import type { LocalAutoTraderVehicle } from "@/lib/integrations/autotrader/mapping";
import type {
  AutoTraderSyncOutcome,
  AutoTraderSyncStore,
  PersistedAutoTraderState,
} from "@/lib/integrations/autotrader/sync";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;
type DatabaseRecord = Record<string, unknown>;

const vehicleSelect = [
  "id",
  "organisation_id",
  "registration",
  "vin",
  "stock_number",
  "make",
  "model",
  "derivative",
  "trim",
  "body_type",
  "fuel_type",
  "transmission",
  "colour",
  "doors",
  "seats",
  "engine_size_cc",
  "power_bhp",
  "co2_emissions_g_km",
  "euro_emissions_standard",
  "year",
  "first_registration_date",
  "mot_expiry",
  "previous_owners",
  "mileage",
  "service_history",
  "number_of_keys",
  "retail_price",
  "actual_sale_price",
  "sold_at",
  "attention_grabber",
  "description",
  "standard_equipment",
  "optional_equipment",
  "features",
  "video_url",
  "interior_colour",
  "interior_material",
  "fuel_consumption_urban_mpg",
  "fuel_consumption_extra_urban_mpg",
  "fuel_consumption_combined_mpg",
  "wheelchair_accessible",
  "acceleration_0_60_seconds",
  "top_speed_mph",
  "engine_number",
  "cylinder_count",
  "drive_type",
  "gross_weight_kg",
  "length_mm",
  "width_mm",
  "plate",
  "advertised_condition",
  "status",
  "deleted_at",
  "autotrader_stock_id",
].join(",");

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value: unknown) {
  const number = numberOrNull(value);
  return number === null ? null : Math.trunc(number);
}

function lines(value: unknown) {
  return typeof value === "string"
    ? value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DatabaseRecord)
    : {};
}

function mapVehicle(
  row: DatabaseRecord,
  channel: DatabaseRecord | undefined,
): LocalAutoTraderVehicle {
  return {
    id: String(row.id),
    organisationId: String(row.organisation_id),
    registration: nullableText(row.registration),
    vin: nullableText(row.vin),
    stockNumber: String(row.stock_number),
    make: String(row.make),
    model: String(row.model),
    derivative: nullableText(row.derivative),
    trim: nullableText(row.trim),
    bodyType: nullableText(row.body_type),
    fuelType: String(row.fuel_type),
    transmission: String(row.transmission),
    colour: nullableText(row.colour),
    doors: integerOrNull(row.doors),
    seats: integerOrNull(row.seats),
    engineSizeCc: integerOrNull(row.engine_size_cc),
    powerBhp: integerOrNull(row.power_bhp),
    co2EmissionsGKm: integerOrNull(row.co2_emissions_g_km),
    euroEmissionsStandard: nullableText(row.euro_emissions_standard),
    year: Number(row.year),
    firstRegistrationDate: nullableText(row.first_registration_date),
    motExpiry: nullableText(row.mot_expiry),
    previousOwners: integerOrNull(row.previous_owners),
    mileage: Number(row.mileage),
    serviceHistory: nullableText(row.service_history),
    keys: integerOrNull(row.number_of_keys),
    retailPrice: numberOrNull(row.retail_price),
    actualSalePrice: numberOrNull(row.actual_sale_price),
    soldAt: nullableText(row.sold_at),
    attentionGrabber: nullableText(row.attention_grabber),
    description: nullableText(row.description),
    standardEquipment: lines(row.standard_equipment),
    optionalEquipment: lines(row.optional_equipment),
    features: stringArray(row.features),
    videoUrl: nullableText(row.video_url),
    interiorColour: nullableText(row.interior_colour),
    interiorMaterial: nullableText(row.interior_material),
    fuelConsumptionUrbanMpg: numberOrNull(row.fuel_consumption_urban_mpg),
    fuelConsumptionExtraUrbanMpg: numberOrNull(
      row.fuel_consumption_extra_urban_mpg,
    ),
    fuelConsumptionCombinedMpg: numberOrNull(
      row.fuel_consumption_combined_mpg,
    ),
    wheelchairAccessible:
      typeof row.wheelchair_accessible === "boolean"
        ? row.wheelchair_accessible
        : null,
    acceleration060Seconds: numberOrNull(row.acceleration_0_60_seconds),
    topSpeedMph: integerOrNull(row.top_speed_mph),
    engineNumber: nullableText(row.engine_number),
    cylinderCount: integerOrNull(row.cylinder_count),
    driveType: nullableText(row.drive_type),
    grossWeightKg: integerOrNull(row.gross_weight_kg),
    lengthMm: integerOrNull(row.length_mm),
    widthMm: integerOrNull(row.width_mm),
    plate: nullableText(row.plate),
    advertisedCondition:
      row.advertised_condition === "new" ||
      row.advertised_condition === "demonstrator" ||
      row.advertised_condition === "pre_registered"
        ? row.advertised_condition
        : "used",
    status: String(row.status),
    deletedAt: nullableText(row.deleted_at),
    autotraderStockId: nullableText(row.autotrader_stock_id),
    channel: channel
      ? {
          status: String(channel.status),
          externalStockId: nullableText(channel.external_stock_id),
          externalDerivativeId: nullableText(channel.external_derivative_id),
          metadata: asObject(channel.metadata),
        }
      : null,
  };
}

async function paginatedVehicles(input: {
  supabase: AdminClient;
  organisationId: string;
  vehicleId?: string;
}) {
  const rows: DatabaseRecord[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    let query = input.supabase
      .from("vehicles")
      .select(vehicleSelect)
      .eq("organisation_id", input.organisationId)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (input.vehicleId) query = query.eq("id", input.vehicleId);
    const response = await query;
    if (response.error) {
      throw new Error("MOTOR.OS stock could not be loaded for Auto Trader sync.");
    }
    const page = (response.data ?? []) as unknown as DatabaseRecord[];
    rows.push(...page);
    if (page.length < pageSize || input.vehicleId) break;
  }
  return rows;
}

export class SupabaseAutoTraderSyncStore implements AutoTraderSyncStore {
  constructor(private readonly supabase: AdminClient) {}

  async listVehicles(input: {
    organisationId: string;
    vehicleId?: string;
  }) {
    const vehicles = await paginatedVehicles({
      supabase: this.supabase,
      ...input,
    });
    if (vehicles.length === 0) return [];

    let channelsQuery = this.supabase
      .from("vehicle_sales_channels")
      .select(
        "vehicle_id,status,external_stock_id,external_derivative_id,metadata",
      )
      .eq("organisation_id", input.organisationId)
      .eq("channel", "autotrader");
    if (input.vehicleId) channelsQuery = channelsQuery.eq("vehicle_id", input.vehicleId);
    const channels = await channelsQuery;
    if (channels.error) {
      throw new Error("Auto Trader vehicle channel settings could not be loaded.");
    }
    const channelByVehicle = new Map(
      ((channels.data ?? []) as DatabaseRecord[]).map((row) => [
        String(row.vehicle_id),
        row,
      ]),
    );
    return vehicles.map((row) =>
      mapVehicle(row, channelByVehicle.get(String(row.id))),
    );
  }

  async beginRecord(input: {
    organisationId: string;
    vehicleId: string;
    operation: string;
    payloadHash: string | null;
    intent: string;
  }) {
    const result = await this.supabase
      .from("vehicle_sync_records")
      .insert({
        organisation_id: input.organisationId,
        vehicle_id: input.vehicleId,
        provider: "autotrader",
        direction: "outbound",
        operation: input.operation,
        status: "processing",
        request_summary: {
          payload_hash: input.payloadHash,
          intent: input.intent,
          sandbox: true,
        },
        response_summary: {},
        attempt_count: 1,
        last_attempt_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (result.error || !result.data) {
      throw new Error("The Auto Trader sync attempt could not be recorded.");
    }
    return String(result.data.id);
  }

  async completeRecord(input: {
    recordId: string;
    status: "succeeded" | "failed" | "skipped";
    externalId: string | null;
    outcome: AutoTraderSyncOutcome;
    errorCode?: string | null;
    errorMessage?: string | null;
    warnings?: string[];
  }) {
    const completedAt = new Date().toISOString();
    const result = await this.supabase
      .from("vehicle_sync_records")
      .update({
        status: input.status,
        external_id: input.externalId,
        response_summary: {
          outcome: input.outcome,
          warning_count: input.warnings?.length ?? 0,
          sandbox: true,
        },
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
        completed_at: completedAt,
      })
      .eq("id", input.recordId)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data) {
      throw new Error("The Auto Trader sync result could not be recorded.");
    }
  }

  async persistVehicleState(input: PersistedAutoTraderState) {
    const now = new Date().toISOString();
    const vehicle = await this.supabase
      .from("vehicles")
      .update({
        autotrader_stock_id: input.externalStockId,
        autotrader_publication_status: input.publicationStatus,
        updated_at: now,
      })
      .eq("id", input.vehicleId)
      .select("organisation_id")
      .single();
    if (vehicle.error || !vehicle.data) {
      throw new Error("The Auto Trader stock identifier could not be saved.");
    }

    const existing = await this.supabase
      .from("vehicle_sales_channels")
      .select("metadata")
      .eq("vehicle_id", input.vehicleId)
      .eq("channel", "autotrader")
      .maybeSingle();
    if (existing.error) {
      throw new Error("The Auto Trader channel state could not be read.");
    }
    const metadata = {
      ...asObject(existing.data?.metadata),
      last_payload_hash: input.payloadHash,
      remote_last_updated: input.remoteLastUpdated,
      remote_version_number: input.remoteVersionNumber,
      warning_count: input.warnings.length,
      sandbox: true,
    };
    const channel = await this.supabase
      .from("vehicle_sales_channels")
      .upsert(
        {
          organisation_id: vehicle.data.organisation_id,
          vehicle_id: input.vehicleId,
          channel: "autotrader",
          status: input.channelStatus,
          external_stock_id: input.externalStockId,
          last_synced_at: now,
          last_error: input.lastError,
          metadata,
        },
        { onConflict: "vehicle_id,channel" },
      )
      .select("id")
      .single();
    if (channel.error || !channel.data) {
      throw new Error("The Auto Trader channel state could not be saved.");
    }
  }

  async markVehicleFailure(input: {
    vehicleId: string;
    errorCode: string;
    errorMessage: string;
  }) {
    const existing = await this.supabase
      .from("vehicle_sales_channels")
      .select("id,metadata")
      .eq("vehicle_id", input.vehicleId)
      .eq("channel", "autotrader")
      .maybeSingle();
    if (existing.error || !existing.data) return;
    await this.supabase
      .from("vehicle_sales_channels")
      .update({
        status: "failed",
        last_error: input.errorMessage,
        metadata: {
          ...asObject(existing.data.metadata),
          last_error_code: input.errorCode,
          sandbox: true,
        },
      })
      .eq("id", existing.data.id);
    await this.supabase
      .from("vehicles")
      .update({ autotrader_publication_status: "failed" })
      .eq("id", input.vehicleId);
  }
}

export function createSupabaseAutoTraderSyncStore() {
  return new SupabaseAutoTraderSyncStore(createAdminSupabaseClient());
}
