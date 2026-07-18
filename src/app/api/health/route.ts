import { NextResponse } from "next/server";

import { getEnvironmentHealth } from "@/lib/env";

export async function GET() {
  const health = getEnvironmentHealth();
  const criticalReady = health.supabase && health.serviceRole;
  return NextResponse.json(
    {
      status: criticalReady ? "ok" : "configuration_required",
      timestamp: new Date().toISOString(),
      checks: {
        database: health.supabase ? "configured" : "missing",
        serverAccess: health.serviceRole ? "configured" : "missing",
        vehicleLookup: health.vehicleLookup ? "available" : "configuration_required",
        email: health.email ? "available" : "configuration_required",
        sms: "not_implemented",
      },
    },
    {
      status: criticalReady ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
