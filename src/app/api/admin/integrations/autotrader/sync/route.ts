import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getAutoTraderCredentials } from "@/lib/integrations/autotrader";
import { AutoTraderClient } from "@/lib/integrations/autotrader/client";
import {
  assertAutoTraderOrganisationBinding,
  updateAutoTraderIntegrationState,
} from "@/lib/integrations/autotrader/state";
import { createSupabaseAutoTraderSyncStore } from "@/lib/integrations/autotrader/store";
import { syncAutoTraderStock } from "@/lib/integrations/autotrader/sync";
import { AutoTraderApiError } from "@/lib/integrations/autotrader/types";
import { log } from "@/lib/security/logger";
import { assertSameOrigin, checkRateLimit } from "@/lib/security/request";

const requestSchema = z.object({
  vehicleId: z.uuid().optional(),
  dryRun: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "integrations:manage")) {
    return NextResponse.json(
      { message: "Integration management permission is required." },
      { status: 403 },
    );
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the Auto Trader sync request." },
      { status: 400 },
    );
  }
  const limit = checkRateLimit(`autotrader-sync:${staff.userId}`, {
    limit: 6,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Wait before starting another Auto Trader sync." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  try {
    const credentials = getAutoTraderCredentials();
    await assertAutoTraderOrganisationBinding({
      organisationId: staff.organisationId,
      credentials,
    });
    if (!parsed.data.dryRun) {
      await updateAutoTraderIntegrationState({
        organisationId: staff.organisationId,
        status: "syncing",
      });
    }
    const result = await syncAutoTraderStock({
      organisationId: staff.organisationId,
      vehicleId: parsed.data.vehicleId,
      dryRun: parsed.data.dryRun,
      client: new AutoTraderClient(credentials),
      store: createSupabaseAutoTraderSyncStore(),
    });
    if (!parsed.data.dryRun) {
      await updateAutoTraderIntegrationState({
        organisationId: staff.organisationId,
        status: result.halted || result.failed > 0 ? "error" : "connected",
        synced: !result.halted && result.failed === 0,
        errorCode: result.halted ? "sync_halted" : result.failed ? "partial_failure" : null,
        errorMessage:
          result.haltReason ??
          (result.failed ? `${result.failed} stock record(s) failed.` : null),
      });
    }
    log(result.failed > 0 ? "warn" : "info", "autotrader.stock_sync_completed", {
      organisationId: staff.organisationId,
      dryRun: parsed.data.dryRun,
      vehicleId: parsed.data.vehicleId ?? null,
      total: result.total,
      created: result.created,
      updated: result.updated,
      unchanged: result.unchanged,
      skipped: result.skipped,
      failed: result.failed,
      halted: result.halted,
    });
    return NextResponse.json(result, {
      status: result.halted ? 503 : result.failed > 0 ? 207 : 200,
    });
  } catch (error) {
    const message =
      error instanceof AutoTraderApiError
        ? [error.message, error.providerMessage].filter(Boolean).join(" ").slice(0, 500)
        : error instanceof Error
          ? error.message.slice(0, 500)
          : "Auto Trader stock sync failed.";
    await updateAutoTraderIntegrationState({
      organisationId: staff.organisationId,
      status:
        error instanceof AutoTraderApiError && error.code === "authentication_failed"
          ? "authentication_failed"
          : error instanceof AutoTraderApiError && error.code === "permission_missing"
            ? "permission_missing"
            : "error",
      errorCode: error instanceof AutoTraderApiError ? error.code : "sync_failed",
      errorMessage: message,
    }).catch(() => undefined);
    log("error", "autotrader.stock_sync_failed", {
      organisationId: staff.organisationId,
      vehicleId: parsed.data.vehicleId ?? null,
      errorCode: error instanceof AutoTraderApiError ? error.code : "sync_failed",
      cfRay: error instanceof AutoTraderApiError ? error.cfRay : null,
    });
    return NextResponse.json({ message }, { status: 503 });
  }
}
