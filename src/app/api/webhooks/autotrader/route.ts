import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import {
  resolveAutoTraderWebhookAdvertiserId,
  verifyAutoTraderWebhook,
} from "@/lib/integrations/autotrader";
import { log } from "@/lib/security/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const eventSchema = z
  .object({
    id: z.string().min(1).max(200),
    type: z.string().min(1).max(120),
    createdAt: z.iso.datetime({ offset: true }).optional(),
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough();

type AdminSupabaseClient = ReturnType<typeof createAdminSupabaseClient>;

class WebhookProcessingError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "WebhookProcessingError";
  }
}

function databaseErrorMessage(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }
  return "Unknown database error";
}

async function recordUnroutableEvent(input: {
  supabase: AdminSupabaseClient;
  event: z.infer<typeof eventSchema>;
  payloadHash: string;
  status: "ignored" | "failed";
  errorCode: string;
  errorMessage: string;
}) {
  const stored = await input.supabase.from("webhook_events").insert({
    organisation_id: null,
    provider: "autotrader",
    external_event_id: input.event.id,
    event_type: input.event.type,
    payload_hash: input.payloadHash,
    signature_valid: true,
    payload: input.event,
    status: input.status,
    attempt_count: 1,
    received_at: new Date().toISOString(),
    occurred_at: input.event.createdAt ?? null,
    processed_at:
      input.status === "ignored" ? new Date().toISOString() : null,
    error_code: input.errorCode,
    error_message: input.errorMessage,
  });

  if (stored.error?.code === "23505") {
    return { ok: true as const, duplicate: true };
  }
  if (stored.error) {
    log("error", "autotrader.webhook_record_failed", {
      errorCode: input.errorCode,
      message: databaseErrorMessage(stored.error),
    });
    return { ok: false as const };
  }
  return { ok: true as const, duplicate: false };
}

async function updateEvent(
  supabase: AdminSupabaseClient,
  eventId: string,
  values: Record<string, unknown>,
) {
  const result = await supabase
    .from("webhook_events")
    .update(values)
    .eq("id", eventId)
    .select("id")
    .maybeSingle();
  if (result.error || !result.data) {
    throw new WebhookProcessingError(
      `Webhook state could not be updated: ${databaseErrorMessage(result.error)}`,
      "event_state_update_failed",
    );
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verification = verifyAutoTraderWebhook({
    rawBody,
    signature: request.headers.get("x-autotrader-signature"),
    timestamp: request.headers.get("x-autotrader-timestamp"),
  });
  if (!verification.ok) {
    log("warn", "autotrader.webhook_rejected", {
      reason: verification.reason,
    });
    return NextResponse.json(
      { message: "Webhook authentication failed." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { message: "Invalid webhook JSON." },
      { status: 400 },
    );
  }
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid webhook payload." },
      { status: 400 },
    );
  }

  let supabase: AdminSupabaseClient;
  try {
    supabase = createAdminSupabaseClient();
  } catch (error) {
    log("error", "autotrader.webhook_database_unavailable", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { message: "Webhook storage is unavailable." },
      { status: 503 },
    );
  }

  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const advertiser = resolveAutoTraderWebhookAdvertiserId(parsed.data);
  if (!advertiser.ok) {
    const errorCode =
      advertiser.reason === "conflicting"
        ? "advertiser_conflict"
        : "advertiser_missing";
    const recorded = await recordUnroutableEvent({
      supabase,
      event: parsed.data,
      payloadHash,
      status: "ignored",
      errorCode,
      errorMessage:
        advertiser.reason === "conflicting"
          ? "Webhook contains conflicting advertiser identifiers."
          : "Webhook does not contain an advertiser identifier.",
    });
    if (!recorded.ok) {
      return NextResponse.json(
        { message: "Webhook could not be recorded." },
        { status: 500 },
      );
    }
    log("warn", "autotrader.webhook_ignored", {
      eventId: parsed.data.id,
      reason: errorCode,
    });
    return NextResponse.json(
      { ok: true, ignored: true, duplicate: recorded.duplicate },
      { status: 202 },
    );
  }

  const integrations = await supabase
    .from("integration_settings")
    .select("id, organisation_id, status")
    .eq("provider", "autotrader")
    .contains("public_configuration", {
      advertiser_id: advertiser.advertiserId,
    })
    .in("status", ["connected", "syncing"])
    .limit(2);
  if (integrations.error) {
    log("error", "autotrader.webhook_routing_failed", {
      eventId: parsed.data.id,
      message: databaseErrorMessage(integrations.error),
    });
    return NextResponse.json(
      { message: "Webhook routing is temporarily unavailable." },
      { status: 503 },
    );
  }

  if ((integrations.data ?? []).length === 0) {
    const recorded = await recordUnroutableEvent({
      supabase,
      event: parsed.data,
      payloadHash,
      status: "ignored",
      errorCode: "advertiser_not_configured",
      errorMessage:
        "No connected Auto Trader integration matches this advertiser.",
    });
    if (!recorded.ok) {
      return NextResponse.json(
        { message: "Webhook could not be recorded." },
        { status: 500 },
      );
    }
    log("warn", "autotrader.webhook_ignored", {
      eventId: parsed.data.id,
      reason: "advertiser_not_configured",
    });
    return NextResponse.json(
      { ok: true, ignored: true, duplicate: recorded.duplicate },
      { status: 202 },
    );
  }

  if ((integrations.data ?? []).length !== 1) {
    const recorded = await recordUnroutableEvent({
      supabase,
      event: parsed.data,
      payloadHash,
      status: "failed",
      errorCode: "advertiser_ambiguous",
      errorMessage:
        "More than one integration matches the webhook advertiser.",
    });
    if (!recorded.ok) {
      return NextResponse.json(
        { message: "Webhook could not be recorded." },
        { status: 500 },
      );
    }
    log("error", "autotrader.webhook_routing_ambiguous", {
      eventId: parsed.data.id,
    });
    return NextResponse.json(
      {
        message: "Webhook advertiser configuration is ambiguous.",
        duplicate: recorded.duplicate,
      },
      { status: 503 },
    );
  }

  const integration = integrations.data![0]!;
  const organisationId = String(integration.organisation_id);
  const stored = await supabase
    .from("webhook_events")
    .insert({
      organisation_id: organisationId,
      provider: "autotrader",
      external_event_id: parsed.data.id,
      event_type: parsed.data.type,
      payload_hash: payloadHash,
      signature_valid: true,
      payload: parsed.data,
      status: "processing",
      attempt_count: 1,
      received_at: new Date().toISOString(),
      occurred_at: parsed.data.createdAt ?? null,
    })
    .select("id")
    .single();

  let storedEventId: string;
  if (stored.error?.code === "23505") {
    const existing = await supabase
      .from("webhook_events")
      .select(
        "id, organisation_id, status, payload_hash, attempt_count",
      )
      .eq("provider", "autotrader")
      .eq("external_event_id", parsed.data.id)
      .single();
    if (existing.error || !existing.data) {
      return NextResponse.json(
        { message: "Duplicate webhook state could not be read." },
        { status: 500 },
      );
    }
    if (
      existing.data.payload_hash !== payloadHash ||
      existing.data.organisation_id !== organisationId
    ) {
      log("error", "autotrader.webhook_id_reuse", {
        eventId: parsed.data.id,
      });
      return NextResponse.json(
        { message: "Webhook event ID has already been used." },
        { status: 409 },
      );
    }
    if (existing.data.status !== "failed") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const claimed = await supabase
      .from("webhook_events")
      .update({
        status: "processing",
        attempt_count: Number(existing.data.attempt_count) + 1,
        next_retry_at: null,
        error_code: null,
        error_message: null,
      })
      .eq("id", existing.data.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (claimed.error) {
      return NextResponse.json(
        { message: "Webhook retry could not be claimed." },
        { status: 500 },
      );
    }
    if (!claimed.data) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    storedEventId = String(claimed.data.id);
  } else if (stored.error || !stored.data) {
    log("error", "autotrader.webhook_record_failed", {
      eventId: parsed.data.id,
      message: databaseErrorMessage(stored.error),
    });
    return NextResponse.json(
      { message: "Webhook could not be recorded." },
      { status: 500 },
    );
  } else {
    storedEventId = String(stored.data.id);
  }

  try {
    const stockId =
      typeof parsed.data.data.stockId === "string"
        ? parsed.data.data.stockId.trim()
        : "";
    const sourceStatus =
      typeof parsed.data.data.status === "string"
        ? parsed.data.data.status.trim().toLowerCase()
        : "";

    if (!stockId || !["reserved", "sold"].includes(sourceStatus)) {
      await updateEvent(supabase, storedEventId, {
        status: "ignored",
        processed_at: new Date().toISOString(),
        next_retry_at: null,
        error_code: "unsupported_event",
        error_message:
          "Event does not contain a supported reserved or sold stock update.",
      });
      return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
    }

    const vehicleUpdate = await supabase
      .from("vehicles")
      .update({
        status: sourceStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("organisation_id", organisationId)
      .eq("autotrader_stock_id", stockId)
      .is("deleted_at", null)
      .select("id");
    if (vehicleUpdate.error) {
      throw new WebhookProcessingError(
        `Vehicle update failed: ${databaseErrorMessage(vehicleUpdate.error)}`,
        "vehicle_update_failed",
      );
    }
    if ((vehicleUpdate.data ?? []).length === 0) {
      throw new WebhookProcessingError(
        "No vehicle matches this organisation and Auto Trader stock ID.",
        "vehicle_not_found",
      );
    }
    if ((vehicleUpdate.data ?? []).length !== 1) {
      throw new WebhookProcessingError(
        "Multiple vehicles match this Auto Trader stock ID.",
        "vehicle_match_ambiguous",
      );
    }

    const integrationUpdate = await supabase
      .from("integration_settings")
      .update({
        last_successful_sync_at: new Date().toISOString(),
        last_error_at: null,
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", integration.id)
      .eq("organisation_id", organisationId)
      .select("id")
      .maybeSingle();
    if (integrationUpdate.error || !integrationUpdate.data) {
      throw new WebhookProcessingError(
        `Integration sync state could not be updated: ${databaseErrorMessage(
          integrationUpdate.error,
        )}`,
        "integration_state_update_failed",
      );
    }

    await updateEvent(supabase, storedEventId, {
      status: "processed",
      processed_at: new Date().toISOString(),
      next_retry_at: null,
      error_code: null,
      error_message: null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorCode =
      error instanceof WebhookProcessingError
        ? error.code
        : "processing_failed";
    const errorMessage =
      error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
    const retryAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const failed = await supabase
      .from("webhook_events")
      .update({
        status: "failed",
        error_code: errorCode,
        error_message: errorMessage,
        next_retry_at: retryAt,
        processed_at: null,
      })
      .eq("id", storedEventId)
      .select("id")
      .maybeSingle();
    if (failed.error || !failed.data) {
      log("error", "autotrader.webhook_failure_state_failed", {
        eventId: parsed.data.id,
        message: databaseErrorMessage(failed.error),
      });
    }
    log("error", "autotrader.webhook_failed", {
      eventId: parsed.data.id,
      errorCode,
      message: errorMessage,
      providerBaseConfigured: Boolean(
        getServerEnv().AUTOTRADER_API_BASE_URL,
      ),
    });
    return NextResponse.json(
      { message: "Webhook processing failed and was recorded." },
      { status: 500 },
    );
  }
}
