import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getAutoTraderConfigurationStatus } from "@/lib/integrations/autotrader";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "integrations:manage")) {
    return NextResponse.json({ message: "Integration access is required." }, { status: 403 });
  }

  const configuration = getAutoTraderConfigurationStatus();
  const supabase = createAdminSupabaseClient();
  const latest = await supabase
    .from("vehicle_sync_records")
    .select("status,completed_at,error_message,updated_at")
    .eq("organisation_id", staff.organisationId)
    .eq("provider", "autotrader")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ...configuration,
    lastSync: latest.data
      ? {
          status: latest.data.status,
          lastSuccessfulSyncAt:
            latest.data.status === "succeeded" ? latest.data.completed_at : null,
          errorMessage: latest.data.error_message,
          updatedAt: latest.data.updated_at,
        }
      : null,
    disclaimer:
      "DealerOS does not scrape Auto Trader and does not claim a connection until authorised API access is verified.",
  });
}
