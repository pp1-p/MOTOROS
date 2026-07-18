import "server-only";

import { format, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/security/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AdminReportsSnapshot = {
  state: "live" | "demo" | "unavailable";
  message: string | null;
  salesYtd: number;
  grossProfitYtd: number;
  monthlySales: Array<{
    key: string;
    label: string;
    sales: number;
    grossProfit: number;
  }>;
  leadSources: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  leadsLast90Days: number;
};

function unavailable(message: string): AdminReportsSnapshot {
  return {
    state: "unavailable",
    message,
    salesYtd: 0,
    grossProfitYtd: 0,
    monthlySales: [],
    leadSources: [],
    leadsLast90Days: 0,
  };
}

function demoSnapshot(): AdminReportsSnapshot {
  const values = [
    ["Feb", 6, 12_400],
    ["Mar", 8, 16_800],
    ["Apr", 7, 14_200],
    ["May", 9, 20_100],
    ["Jun", 8, 18_700],
    ["Jul", 9, 22_300],
  ] as const;
  return {
    state: "demo",
    message: "Development demo data is shown. Connect Supabase for dealership reporting.",
    salesYtd: 47,
    grossProfitYtd: 108_640,
    monthlySales: values.map(([label, sales, grossProfit], index) => ({
      key: `demo-${index}`,
      label,
      sales,
      grossProfit,
    })),
    leadSources: [
      { source: "Website", count: 48, percentage: 38 },
      { source: "Auto Trader", count: 32, percentage: 25 },
      { source: "Telephone", count: 21, percentage: 17 },
      { source: "Referral", count: 14, percentage: 11 },
      { source: "Other", count: 11, percentage: 9 },
    ],
    leadsLast90Days: 126,
  };
}

function sourceLabel(value: string | null) {
  const source = (value ?? "Other").trim().replaceAll("_", " ");
  return source
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "Other";
}

export async function getAdminReportsSnapshot(): Promise<AdminReportsSnapshot> {
  if (!isSupabaseConfigured()) {
    return isDevelopmentDemoMode()
      ? demoSnapshot()
      : unavailable("Reporting is unavailable until Supabase is configured.");
  }
  if (!getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return unavailable("Reporting requires Supabase service access.");
  }

  const staff = await getStaffContext();
  if (!staff || !hasPermission(staff.role, "reports:view")) {
    return unavailable("Reporting is not available for this account.");
  }

  try {
    const supabase = createAdminSupabaseClient();
    const now = new Date();
    const firstMonth = startOfMonth(subMonths(now, 5));
    const yearStart = startOfYear(now);
    const salesStart = yearStart < firstMonth ? yearStart : firstMonth;
    const leadsStart = subDays(now, 90);
    const [salesResult, leadsResult] = await Promise.all([
      supabase
        .from("sales")
        .select("status,sale_date,gross_profit")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .eq("status", "completed")
        .gte("sale_date", format(salesStart, "yyyy-MM-dd")),
      supabase
        .from("leads")
        .select("source,created_at")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .gte("created_at", leadsStart.toISOString()),
    ]);
    if (salesResult.error || leadsResult.error) {
      throw new Error(salesResult.error?.message ?? leadsResult.error?.message);
    }

    const sales = salesResult.data ?? [];
    const monthStarts = Array.from({ length: 6 }, (_, index) =>
      startOfMonth(subMonths(now, 5 - index)),
    );
    const monthlySales = monthStarts.map((month) => {
      const key = format(month, "yyyy-MM");
      const rows = sales.filter((sale) => sale.sale_date?.slice(0, 7) === key);
      return {
        key,
        label: format(month, "MMM"),
        sales: rows.length,
        grossProfit: rows.reduce(
          (total, sale) => total + Number(sale.gross_profit ?? 0),
          0,
        ),
      };
    });
    const ytd = sales.filter(
      (sale) => sale.sale_date && sale.sale_date >= format(yearStart, "yyyy-MM-dd"),
    );

    const sourceCounts = new Map<string, number>();
    for (const lead of leadsResult.data ?? []) {
      const label = sourceLabel(lead.source);
      sourceCounts.set(label, (sourceCounts.get(label) ?? 0) + 1);
    }
    const sortedSources = [...sourceCounts.entries()].sort(
      (left, right) => right[1] - left[1],
    );
    const leadingSources = sortedSources.slice(0, 4);
    const otherCount = sortedSources
      .slice(4)
      .reduce((total, [, count]) => total + count, 0);
    if (otherCount) leadingSources.push(["Other", otherCount]);
    const leadTotal = (leadsResult.data ?? []).length;

    return {
      state: "live",
      message: null,
      salesYtd: ytd.length,
      grossProfitYtd: ytd.reduce(
        (total, sale) => total + Number(sale.gross_profit ?? 0),
        0,
      ),
      monthlySales,
      leadSources: leadingSources.map(([source, count]) => ({
        source,
        count,
        percentage: leadTotal ? Math.round((count / leadTotal) * 100) : 0,
      })),
      leadsLast90Days: leadTotal,
    };
  } catch (error) {
    log("error", "admin_reports.snapshot_failed", {
      message: error instanceof Error ? error.message : "Unknown reporting query failure",
    });
    return unavailable("Live reporting could not be loaded. Try again or check System health.");
  }
}
