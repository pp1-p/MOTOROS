import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const allowedReports = new Set([
  "monthly-summary",
  "stock-status",
  "stock-age",
  "gross-profit",
  "lead-conversion",
  "sourcing",
  "repairs",
  "sales",
]);

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return '"message"\r\n"No records found"\r\n';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\r\n");
}

export async function GET(request: Request) {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "reports:view")) {
    return NextResponse.json({ message: "Reporting access is required." }, { status: 403 });
  }
  const report = new URL(request.url).searchParams.get("report") ?? "monthly-summary";
  if (!allowedReports.has(report)) {
    return NextResponse.json({ message: "Unknown report." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const organisationId = staff.organisationId;
  let rows: Array<Record<string, unknown>> = [];

  if (report === "stock-status") {
    const result = await supabase
      .from("vehicles")
      .select("stock_number,registration,make,model,status,retail_price,purchase_price,created_at")
      .eq("organisation_id", organisationId)
      .is("deleted_at", null)
      .order("status");
    rows = result.data ?? [];
  } else if (report === "stock-age") {
    const result = await supabase
      .from("vehicles")
      .select("stock_number,registration,make,model,status,acquired_at,created_at")
      .eq("organisation_id", organisationId)
      .not("status", "in", '("sold","archived","returned")')
      .is("deleted_at", null);
    rows = (result.data ?? []).map((vehicle) => {
      const acquired = new Date(vehicle.acquired_at ?? vehicle.created_at);
      return {
        ...vehicle,
        age_days: Math.max(
          0,
          Math.floor((Date.now() - acquired.getTime()) / 86_400_000),
        ),
      };
    });
  } else if (report === "gross-profit" || report === "sales") {
    const result = await supabase
      .from("sales")
      .select(
        "reference,vehicle_id,customer_id,salesperson_id,status,sale_price,gross_profit,sale_date,handover_date",
      )
      .eq("organisation_id", organisationId)
      .is("deleted_at", null)
      .order("sale_date", { ascending: false });
    rows = result.data ?? [];
  } else if (report === "lead-conversion") {
    const result = await supabase
      .from("leads")
      .select("reference,lead_type,status,source,assigned_user_id,created_at,closed_at,lost_reason")
      .eq("organisation_id", organisationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    rows = result.data ?? [];
  } else if (report === "sourcing") {
    const result = await supabase
      .from("sourcing_requests")
      .select(
        "reference,status,priority,preferred_make,preferred_model,budget,sourcing_fee,assigned_user_id,created_at,closed_at,lost_reason",
      )
      .eq("organisation_id", organisationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    rows = result.data ?? [];
  } else if (report === "repairs") {
    const result = await supabase
      .from("repair_jobs")
      .select(
        "reference,status,registration,vehicle_make_model,estimate_total,approval_status,payment_status,start_date,due_date,collection_date",
      )
      .eq("organisation_id", organisationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    rows = result.data ?? [];
  } else {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [vehicles, leads, sourcing, appointments, repairs, tasks, sales] =
      await Promise.all([
        supabase
          .from("vehicles")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", organisationId)
          .not("status", "in", '("sold","archived","returned")')
          .is("deleted_at", null),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", organisationId)
          .gte("created_at", monthStart.toISOString())
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
          .gte("starts_at", monthStart.toISOString())
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
          .lt("due_at", new Date().toISOString())
          .in("status", ["open", "in_progress", "blocked"])
          .is("deleted_at", null),
        supabase
          .from("sales")
          .select("sale_price,gross_profit")
          .eq("organisation_id", organisationId)
          .gte("sale_date", monthStart.toISOString().slice(0, 10))
          .neq("status", "cancelled")
          .is("deleted_at", null),
      ]);
    rows = [
      { metric: "Vehicles in stock", value: vehicles.count ?? 0 },
      { metric: "Leads created this month", value: leads.count ?? 0 },
      { metric: "Open sourcing requests", value: sourcing.count ?? 0 },
      { metric: "Appointments this month", value: appointments.count ?? 0 },
      { metric: "Open repair jobs", value: repairs.count ?? 0 },
      { metric: "Overdue tasks", value: tasks.count ?? 0 },
      {
        metric: "Sales revenue this month",
        value: (sales.data ?? []).reduce(
          (total, sale) => total + Number(sale.sale_price ?? 0),
          0,
        ),
      },
      {
        metric: "Gross profit this month",
        value: (sales.data ?? []).reduce(
          (total, sale) => total + Number(sale.gross_profit ?? 0),
          0,
        ),
      },
    ];
  }

  await supabase.from("audit_logs").insert({
    organisation_id: organisationId,
    actor_user_id: staff.userId,
    action: "report.exported",
    entity_type: "report",
    change_reason: report,
  });

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dealeros-${report}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
