import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/security/logger";
import {
  assertSameOrigin,
  checkRateLimit,
  getClientFingerprint,
} from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getVehicleLookupProvider } from "@/lib/vehicle-lookup/provider";
import { validateAndNormaliseRegistration } from "@/lib/vehicle-lookup/registration";
import { VehicleLookupError } from "@/lib/vehicle-lookup/types";

const schema = z.object({ registration: z.string().min(2).max(12) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "stock:manage")) {
    return NextResponse.json({ message: "You do not have stock-management access." }, { status: 403 });
  }

  const rate = checkRateLimit(
    `vehicle-lookup:${staff.userId}:${getClientFingerprint(request)}`,
    { limit: 20, windowMs: 10 * 60_000 },
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Vehicle lookup limit reached. Try again shortly.", manualFallback: true },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter a registration number.", manualFallback: true },
      { status: 400 },
    );
  }

  let registration: string;
  try {
    registration = validateAndNormaliseRegistration(parsed.data.registration);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Invalid registration.",
        manualFallback: true,
        code: "invalid_registration",
      },
      { status: 400 },
    );
  }

  const startedAt = Date.now();
  const registrationHash = createHash("sha256").update(registration).digest("hex");
  let providerName = "unavailable";

  try {
    if (isSupabaseConfigured()) {
      const supabase = createAdminSupabaseClient();
      const duplicate = await supabase
        .from("vehicles")
        .select("id,stock_number,status")
        .eq("organisation_id", staff.organisationId)
        .eq("registration_normalised", registration)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (duplicate.data) {
        return NextResponse.json(
          {
            message: `That registration is already in stock (${duplicate.data.stock_number}).`,
            code: "duplicate_registration",
            duplicate: duplicate.data,
            manualFallback: false,
          },
          { status: 409 },
        );
      }
    }

    const provider = getVehicleLookupProvider();
    providerName = provider.name;
    const data = await provider.lookupByRegistration(registration);

    if (isSupabaseConfigured()) {
      const supabase = createAdminSupabaseClient();
      await supabase.from("vehicle_lookup_logs").insert({
        organisation_id: staff.organisationId,
        requested_by: staff.userId,
        provider: provider.name,
        registration_hash: registrationHash,
        result_status: "success",
        duration_ms: Date.now() - startedAt,
        response_fields: Object.keys(data).filter(
          (key) => data[key as keyof typeof data] !== null,
        ),
      });
    }

    return NextResponse.json({
      ok: true,
      data,
      message: "Review and confirm every detail before creating the stock record.",
      manualFallback: false,
    });
  } catch (error) {
    const lookupError =
      error instanceof VehicleLookupError
        ? error
        : new VehicleLookupError(
            "provider_unavailable",
            "The vehicle provider is currently unavailable.",
            true,
          );

    log("warn", "vehicle_lookup.failed", {
      provider: providerName,
      code: lookupError.code,
      durationMs: Date.now() - startedAt,
      registrationHash: registrationHash.slice(0, 12),
    });

    if (isSupabaseConfigured()) {
      const supabase = createAdminSupabaseClient();
      await supabase.from("vehicle_lookup_logs").insert({
        organisation_id: staff.organisationId,
        requested_by: staff.userId,
        provider: providerName,
        registration_hash: registrationHash,
        result_status: "failed",
        error_code: lookupError.code,
        duration_ms: Date.now() - startedAt,
      });
    }

    const status =
      lookupError.code === "not_found"
        ? 404
        : lookupError.code === "rate_limited"
          ? 429
          : lookupError.code === "invalid_registration"
            ? 400
            : 503;
    return NextResponse.json(
      {
        ok: false,
        message: lookupError.message,
        code: lookupError.code,
        manualFallback: true,
        retryable: lookupError.retryable,
      },
      { status },
    );
  }
}
