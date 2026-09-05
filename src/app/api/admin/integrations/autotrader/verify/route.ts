import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getAutoTraderCredentials } from "@/lib/integrations/autotrader";
import { AutoTraderClient } from "@/lib/integrations/autotrader/client";
import { updateAutoTraderIntegrationState } from "@/lib/integrations/autotrader/state";
import { AutoTraderApiError } from "@/lib/integrations/autotrader/types";
import { log } from "@/lib/security/logger";
import { assertSameOrigin, checkRateLimit } from "@/lib/security/request";

function stateForError(error: unknown) {
  if (error instanceof AutoTraderApiError) {
    if (error.code === "authentication_failed") return "authentication_failed" as const;
    if (error.code === "permission_missing") return "permission_missing" as const;
  }
  return "error" as const;
}

function safeMessage(error: unknown) {
  if (error instanceof AutoTraderApiError) {
    return [error.message, error.providerMessage]
      .filter(Boolean)
      .join(" ")
      .slice(0, 500);
  }
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "Auto Trader sandbox verification failed.";
}

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
  const limit = checkRateLimit(`autotrader-verify:${staff.userId}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Wait before checking Auto Trader again." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  try {
    const client = new AutoTraderClient(getAutoTraderCredentials());
    const verification = await client.verifyConnection();
    await updateAutoTraderIntegrationState({
      organisationId: staff.organisationId,
      status: "connected",
      connected: true,
    });
    log("info", "autotrader.sandbox_verified", {
      organisationId: staff.organisationId,
      totalStockRecords: verification.totalResults,
    });
    return NextResponse.json({
      ok: true,
      environment: "sandbox",
      totalStockRecords: verification.totalResults,
      message: "Auto Trader sandbox authentication and stock-read access are working.",
    });
  } catch (error) {
    const message = safeMessage(error);
    const code = error instanceof AutoTraderApiError ? error.code : "verification_failed";
    await updateAutoTraderIntegrationState({
      organisationId: staff.organisationId,
      status: stateForError(error),
      errorCode: code,
      errorMessage: message,
    }).catch(() => undefined);
    log("warn", "autotrader.sandbox_verification_failed", {
      organisationId: staff.organisationId,
      errorCode: code,
      cfRay: error instanceof AutoTraderApiError ? error.cfRay : null,
    });
    return NextResponse.json(
      { message, code },
      { status: error instanceof AutoTraderApiError ? error.status ?? 503 : 503 },
    );
  }
}
