import "server-only";

import { startOfMonth } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/security/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DashboardSnapshot = {
  mode: "live" | "demo";
  canViewCommercial: boolean;
  canViewLeads: boolean;
  canViewRepairs: boolean;
  canViewSourcing: boolean;
  displayName: string;
  vehiclesInStock: number;
  vehiclesDueIn: number;
  vehiclesReserved: number;
  vehiclesSoldThisMonth: number;
  newSalesLeads: number;
  leadsRequiringFollowUp: number;
  openSourcingRequests: number;
  repairCallsToday: number;
  repairJobsInProgress: number;
  overdueTasks: number;
  estimatedStockValue: number;
  estimatedGrossProfit: number;
  salesRevenueThisMonth: number;
  realisedGrossProfitThisMonth: number;
  stockReadyForSale: number;
  stockInPreparation: number;
  stockAgeing60Days: number;
  tasksCompletedToday: number;
  expectedGrossInNegotiation: number;
};

function count(result: { count: number | null }) {
  return result.count ?? 0;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot | null> {
  if (!isSupabaseConfigured()) {
    if (!isDevelopmentDemoMode()) return null;
    return {
      mode: "demo",
      canViewCommercial: true,
      canViewLeads: true,
      canViewRepairs: true,
      canViewSourcing: true,
      displayName: "Tom Harris",
      vehiclesInStock: 24,
      vehiclesDueIn: 3,
      vehiclesReserved: 2,
      vehiclesSoldThisMonth: 8,
      newSalesLeads: 7,
      leadsRequiringFollowUp: 3,
      openSourcingRequests: 5,
      repairCallsToday: 5,
      repairJobsInProgress: 4,
      overdueTasks: 4,
      estimatedStockValue: 106_550,
      estimatedGrossProfit: 42_700,
      salesRevenueThisMonth: 172_740,
      realisedGrossProfitThisMonth: 18_420,
      stockReadyForSale: 11,
      stockInPreparation: 6,
      stockAgeing60Days: 2,
      tasksCompletedToday: 12,
      expectedGrossInNegotiation: 4_910,
    };
  }

  const staff = await getStaffContext();
  if (!staff) return null;
  const canViewCommercial = hasPermission(staff.role, "commercial:view");
  const canViewLeads = hasPermission(staff.role, "leads:view");
  const canViewRepairs = hasPermission(staff.role, "repairs:view");
  const canViewSourcing = hasPermission(staff.role, "sourcing:view");

  try {
    const supabase = await createServerSupabaseClient();
    const timezone = "Europe/London";
    const now = new Date();
    const localDate = formatInTimeZone(now, timezone, "yyyy-MM-dd");
    const dayStart = fromZonedTime(`${localDate}T00:00:00`, timezone);
    const nextDayStart = new Date(dayStart.getTime() + 24 * 60 * 60_000);
    const monthStart = startOfMonth(dayStart);
    const organisationId = staff.organisationId;

    const [
      stock,
      dueIn,
      reserved,
      sold,
      newLeads,
      followUps,
      sourcing,
      appointments,
      repairs,
      tasks,
      stockRows,
      completedTasks,
    ] = await Promise.all([
      supabase
        .from("staff_vehicle_records")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .not("status", "in", '("sold","returned","archived")')
        .is("deleted_at", null),
      supabase
        .from("staff_vehicle_records")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .eq("status", "due_in")
        .is("deleted_at", null),
      supabase
        .from("staff_vehicle_records")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .eq("status", "reserved")
        .is("deleted_at", null),
      supabase
        .from("staff_vehicle_records")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .eq("status", "sold")
        .gte("sold_at", formatInTimeZone(monthStart, timezone, "yyyy-MM-dd"))
        .is("deleted_at", null),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .eq("status", "new")
        .is("deleted_at", null),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .lte("due_at", now.toISOString())
        .not("status", "in", '("won","lost","spam")')
        .is("deleted_at", null),
      supabase
        .from("sourcing_requests")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .not("status", "in", '("completed","lost")')
        .is("deleted_at", null),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", nextDayStart.toISOString())
        .not("status", "in", '("cancelled","no_show")')
        .is("deleted_at", null),
      supabase
        .from("repair_jobs")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .not("status", "in", '("collected","cancelled")')
        .is("deleted_at", null),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .lt("due_at", now.toISOString())
        .in("status", ["open", "in_progress", "blocked"])
        .is("deleted_at", null),
      supabase
        .from("staff_vehicle_records")
        .select("status,acquired_at,created_at")
        .eq("organisation_id", organisationId)
        .not("status", "in", '("sold","returned","archived")')
        .is("deleted_at", null),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .eq("status", "completed")
        .gte("completed_at", dayStart.toISOString())
        .lt("completed_at", nextDayStart.toISOString())
        .is("deleted_at", null),
    ]);

    const failed = [
      stock,
      dueIn,
      reserved,
      sold,
      newLeads,
      followUps,
      sourcing,
      appointments,
      repairs,
      tasks,
      stockRows,
      completedTasks,
    ].find((result) => result.error);
    if (failed?.error) throw failed.error;

    let estimatedStockValue = 0;
    let estimatedGrossProfit = 0;
    let salesRevenueThisMonth = 0;
    let realisedGrossProfitThisMonth = 0;
    let expectedGrossInNegotiation = 0;
    if (canViewCommercial) {
      const commercial = createAdminSupabaseClient();
      const [commercialStock, salesRows, pipelineSales] = await Promise.all([
        commercial
          .from("vehicles")
          .select("purchase_price,estimated_gross_profit")
          .eq("organisation_id", organisationId)
          .not("status", "in", '("sold","returned","archived")')
          .is("deleted_at", null),
        commercial
          .from("sales")
          .select("sale_price,gross_profit")
          .eq("organisation_id", organisationId)
          .gte("sale_date", formatInTimeZone(monthStart, timezone, "yyyy-MM-dd"))
          .eq("status", "completed")
          .is("deleted_at", null),
        commercial
          .from("sales")
          .select("gross_profit")
          .eq("organisation_id", organisationId)
          .in("status", ["negotiation", "deposit_taken", "reserved", "sale_agreed"])
          .is("deleted_at", null),
      ]);
      const commercialFailure = [commercialStock, salesRows, pipelineSales].find(
        (result) => result.error,
      );
      if (commercialFailure?.error) throw commercialFailure.error;
      estimatedStockValue = (commercialStock.data ?? []).reduce(
        (total, vehicle) => total + Number(vehicle.purchase_price ?? 0),
        0,
      );
      estimatedGrossProfit = (commercialStock.data ?? []).reduce(
        (total, vehicle) => total + Number(vehicle.estimated_gross_profit ?? 0),
        0,
      );
      salesRevenueThisMonth = (salesRows.data ?? []).reduce(
        (total, sale) => total + Number(sale.sale_price ?? 0),
        0,
      );
      realisedGrossProfitThisMonth = (salesRows.data ?? []).reduce(
        (total, sale) => total + Number(sale.gross_profit ?? 0),
        0,
      );
      expectedGrossInNegotiation = (pipelineSales.data ?? []).reduce(
        (total, sale) => total + Number(sale.gross_profit ?? 0),
        0,
      );
    }
    const stockReadyForSale = (stockRows.data ?? []).filter((vehicle) =>
      ["ready_for_sale", "on_forecourt"].includes(vehicle.status),
    ).length;
    const stockInPreparation = (stockRows.data ?? []).filter((vehicle) =>
      ["appraisal", "purchased", "preparation", "photography_required"].includes(
        vehicle.status,
      ),
    ).length;
    const stockAgeing60Days = (stockRows.data ?? []).filter((vehicle) => {
      const acquired = new Date(vehicle.acquired_at ?? vehicle.created_at);
      return now.getTime() - acquired.getTime() > 60 * 86_400_000;
    }).length;
    return {
      mode: "live",
      canViewCommercial,
      canViewLeads,
      canViewRepairs,
      canViewSourcing,
      displayName: staff.displayName,
      vehiclesInStock: count(stock),
      vehiclesDueIn: count(dueIn),
      vehiclesReserved: count(reserved),
      vehiclesSoldThisMonth: count(sold),
      newSalesLeads: count(newLeads),
      leadsRequiringFollowUp: count(followUps),
      openSourcingRequests: count(sourcing),
      repairCallsToday: count(appointments),
      repairJobsInProgress: count(repairs),
      overdueTasks: count(tasks),
      estimatedStockValue,
      estimatedGrossProfit,
      salesRevenueThisMonth,
      realisedGrossProfitThisMonth,
      stockReadyForSale,
      stockInPreparation,
      stockAgeing60Days,
      tasksCompletedToday: count(completedTasks),
      expectedGrossInNegotiation,
    };
  } catch (error) {
    log("error", "dashboard.snapshot_failed", {
      message:
        error instanceof Error ? error.message : "Unknown dashboard query failure",
    });
    return null;
  }
}
