import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAutoTraderCredentialBinding,
  getAutoTraderCredentials,
  resolveAutoTraderWebhookAdvertiserId,
  verifyAutoTraderWebhook,
} from "@/lib/integrations/autotrader";
import type { AutoTraderCredentials } from "@/lib/integrations/autotrader/types";
import { log } from "@/lib/security/logger";
import { secureCompare } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const eventSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    time: z.iso.datetime({ offset: true }),
    type: z.literal("STOCK_UPDATE"),
    integrationId: z.string().trim().min(1).max(200).optional(),
    data: z
      .object({
        advertiser: z
          .object({ advertiserId: z.string().trim().min(1).max(200) })
          .passthrough(),
        metadata: z
          .object({
            stockId: z.string().trim().min(1).max(200),
            lifecycleState: z.string().trim().min(1).max(80),
            externalStockId: z.string().trim().max(200).nullish(),
          })
          .passthrough(),
        adverts: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough(),
    changedFields: z.array(z.string().max(300)).optional(),
  })
  .passthrough();

type Event = z.infer<typeof eventSchema>;
type AdminClient = ReturnType<typeof createAdminSupabaseClient>;
type JsonRecord = Record<string, unknown>;

function asObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function databaseMessage(value: unknown) {
  return value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message.slice(0, 500)
    : "Unknown database error";
}

function externalEventId(event: Event) {
  // A Stock Notification's id is its stockId, not a unique delivery ID.
  return `${event.id}:${event.time}`;
}

function reservationStatus(event: Event) {
  const adverts = asObject(event.data.adverts);
  const direct = adverts.reservationStatus;
  if (typeof direct === "string") return direct.toLowerCase();
  const autoTraderAdvert = asObject(adverts.autotraderAdvert);
  return typeof autoTraderAdvert.reservationStatus === "string"
    ? autoTraderAdvert.reservationStatus.toLowerCase()
    : "";
}

function localVehicleStatus(event: Event) {
  switch (event.data.metadata.lifecycleState.toUpperCase()) {
    case "DUE_IN":
      return "due_in";
    case "FORECOURT":
      return "on_forecourt";
    case "SALE_IN_PROGRESS":
      return reservationStatus(event) === "reserved"
        ? "reserved"
        : "sale_in_progress";
    case "SOLD":
      return "sold";
    case "WASTEBIN":
    case "DELETED":
      return "archived";
    default:
      return null;
  }
}

async function markEvent(
  supabase: AdminClient,
  id: string,
  status: "processed" | "ignored" | "failed",
  code: string | null,
  message: string | null,
) {
  const result = await supabase
    .from("webhook_events")
    .update({
      status,
      processed_at: status === "failed" ? null : new Date().toISOString(),
      next_retry_at:
        status === "failed"
          ? new Date(Date.now() + 5 * 60_000).toISOString()
          : null,
      error_code: code,
      error_message: message,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (result.error || !result.data) {
    throw new Error("The Auto Trader notification state could not be saved.");
  }
}

async function recordUnroutable(input: {
  supabase: AdminClient;
  event: Event;
  payloadHash: string;
  code: string;
  message: string;
}) {
  const result = await input.supabase.from("webhook_events").insert({
    organisation_id: null,
    provider: "autotrader",
    external_event_id: externalEventId(input.event),
    event_type: input.event.type,
    payload_hash: input.payloadHash,
    signature_valid: true,
    received_at: new Date().toISOString(),
    occurred_at: input.event.time,
    status: "ignored",
    attempt_count: 1,
    processed_at: new Date().toISOString(),
    error_code: input.code,
    error_message: input.message,
    payload: input.event,
  });
  return !result.error || result.error.code === "23505";
}

export async function PUT(request: Request) {
  const rawBody = await request.text();
  const verification = verifyAutoTraderWebhook({
    rawBody,
    signatureHeader: request.headers.get("autotrader-signature"),
  });
  if (!verification.ok) {
    log("warn", "autotrader.notification_rejected", {
      reason: verification.reason,
    });
    return NextResponse.json(
      { message: "Auto Trader notification authentication failed." },
      { status: 401 },
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Invalid notification JSON." }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(decoded);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid Auto Trader stock notification." },
      { status: 400 },
    );
  }
  const event = parsed.data;
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  let supabase: AdminClient;
  try {
    supabase = createAdminSupabaseClient();
  } catch {
    return NextResponse.json(
      { message: "Notification storage is unavailable." },
      { status: 503 },
    );
  }

  const advertiser = resolveAutoTraderWebhookAdvertiserId(event);
  let credentials: AutoTraderCredentials;
  try {
    credentials = getAutoTraderCredentials();
  } catch {
    return NextResponse.json(
      { message: "The advertiser is not configured." },
      { status: 422 },
    );
  }
  const configuredAdvertiserId = credentials.advertiserId;
  if (
    !advertiser.ok ||
    !configuredAdvertiserId ||
    !secureCompare(advertiser.advertiserId, configuredAdvertiserId)
  ) {
    const code =
      !advertiser.ok && advertiser.reason === "conflicting"
        ? "advertiser_conflict"
        : !advertiser.ok
          ? "advertiser_missing"
          : "advertiser_not_configured";
    await recordUnroutable({
      supabase,
      event,
      payloadHash,
      code,
      message: "The notification advertiser could not be resolved.",
    });
    return NextResponse.json(
      { message: "The advertiser identifier is invalid." },
      { status: 422 },
    );
  }

  const integrations = await supabase
    .from("integration_settings")
    .select("id,organisation_id,public_configuration")
    .eq("provider", "autotrader")
    .contains("public_configuration", {
      credential_binding: getAutoTraderCredentialBinding(credentials),
    })
    .in("status", ["connected", "syncing"])
    .limit(2);
  if (integrations.error) {
    return NextResponse.json(
      { message: "Notification routing is temporarily unavailable." },
      { status: 503 },
    );
  }
  if ((integrations.data ?? []).length !== 1) {
    await recordUnroutable({
      supabase,
      event,
      payloadHash,
      code: "advertiser_not_configured",
      message: "No single connected dealership matches this advertiser.",
    });
    return NextResponse.json(
      { message: "The advertiser is not configured." },
      { status: 422 },
    );
  }

  const integration = integrations.data![0]!;
  const organisationId = String(integration.organisation_id);
  const configuration = asObject(integration.public_configuration);
  const ownIntegrationId =
    typeof configuration.integration_id === "string"
      ? configuration.integration_id
      : null;
  const stored = await supabase
    .from("webhook_events")
    .insert({
      organisation_id: organisationId,
      provider: "autotrader",
      external_event_id: externalEventId(event),
      event_type: event.type,
      payload_hash: payloadHash,
      signature_valid: true,
      received_at: new Date().toISOString(),
      occurred_at: event.time,
      status: "processing",
      attempt_count: 1,
      payload: event,
    })
    .select("id")
    .single();
  if (stored.error?.code === "23505") {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (stored.error || !stored.data) {
    log("error", "autotrader.notification_record_failed", {
      organisationId,
      message: databaseMessage(stored.error),
    });
    return NextResponse.json(
      { message: "The notification could not be recorded." },
      { status: 500 },
    );
  }
  const storedEventId = String(stored.data.id);

  try {
    if (ownIntegrationId && event.integrationId === ownIntegrationId) {
      await markEvent(
        supabase,
        storedEventId,
        "ignored",
        "own_integration",
        "This update originated from the MOTOR.OS integration.",
      );
      return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
    }

    const stockId = event.data.metadata.stockId;
    let vehicles = await supabase
      .from("vehicles")
      .select("id,status")
      .eq("organisation_id", organisationId)
      .eq("autotrader_stock_id", stockId)
      .is("deleted_at", null)
      .limit(2);
    const externalStockId = event.data.metadata.externalStockId;
    if (
      !vehicles.error &&
      (vehicles.data ?? []).length === 0 &&
      externalStockId &&
      z.string().uuid().safeParse(externalStockId).success
    ) {
      vehicles = await supabase
        .from("vehicles")
        .select("id,status")
        .eq("organisation_id", organisationId)
        .eq("id", externalStockId)
        .is("deleted_at", null)
        .limit(2);
    }
    if (vehicles.error) throw new Error("The affected stock record could not be found.");
    if ((vehicles.data ?? []).length !== 1) {
      await markEvent(
        supabase,
        storedEventId,
        "ignored",
        "vehicle_not_found",
        "No single local vehicle matches this stock notification.",
      );
      return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
    }
    const vehicle = vehicles.data![0]!;

    const channelResult = await supabase
      .from("vehicle_sales_channels")
      .select("id,metadata")
      .eq("organisation_id", organisationId)
      .eq("vehicle_id", vehicle.id)
      .eq("channel", "autotrader")
      .maybeSingle();
    if (channelResult.error) throw new Error("The stock channel could not be read.");
    const channelMetadata = asObject(channelResult.data?.metadata);
    const lastNotificationTime =
      typeof channelMetadata.last_notification_time === "string"
        ? Date.parse(channelMetadata.last_notification_time)
        : Number.NaN;
    if (Number.isFinite(lastNotificationTime) && Date.parse(event.time) <= lastNotificationTime) {
      await markEvent(
        supabase,
        storedEventId,
        "ignored",
        "out_of_order",
        "A newer stock notification has already been processed.",
      );
      return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
    }

    const status = localVehicleStatus(event);
    if (status) {
      const update = await supabase
        .from("vehicles")
        .update({
          status,
          autotrader_stock_id: stockId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vehicle.id)
        .eq("organisation_id", organisationId)
        .select("id")
        .maybeSingle();
      if (update.error || !update.data) {
        throw new Error("The local vehicle status could not be updated.");
      }
    }

    const channel = await supabase.from("vehicle_sales_channels").upsert(
      {
        organisation_id: organisationId,
        vehicle_id: vehicle.id,
        channel: "autotrader",
        external_stock_id: stockId,
        last_synced_at: new Date().toISOString(),
        metadata: {
          ...channelMetadata,
          sandbox: true,
          last_notification_time: event.time,
          remote_lifecycle_state: event.data.metadata.lifecycleState,
          changed_fields: event.changedFields ?? [],
        },
      },
      { onConflict: "vehicle_id,channel" },
    );
    if (channel.error) throw new Error("The stock channel could not be updated.");

    await markEvent(supabase, storedEventId, "processed", null, null);
    log("info", "autotrader.notification_processed", {
      organisationId,
      vehicleId: String(vehicle.id),
      stockId,
      lifecycleState: event.data.metadata.lifecycleState,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Processing failed.";
    await markEvent(
      supabase,
      storedEventId,
      "failed",
      "processing_failed",
      message,
    ).catch(() => undefined);
    log("error", "autotrader.notification_failed", {
      organisationId,
      stockId: event.data.metadata.stockId,
      message,
    });
    return NextResponse.json(
      { message: "Notification processing failed and was recorded." },
      { status: 500 },
    );
  }
}

// Auto Trader documents HTTPS PUT. POST remains a compatibility alias for
// previously registered sandbox webhook URLs while they are being updated.
export const POST = PUT;
