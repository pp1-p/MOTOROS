import "server-only";

import { addHours, formatDistanceToNowStrict } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type TodayFocusItem = {
  id: string;
  href: string;
  title: string;
  detail: string;
  emphasis?: "info" | "warning" | "critical";
};

export type TodayFocus = {
  nextAppointment: TodayFocusItem | null;
  followUps: TodayFocusItem[];
  agedStock: TodayFocusItem[];
  awaitingApproval: TodayFocusItem[];
  overdueInvoices: TodayFocusItem[];
};

const EMPTY: TodayFocus = {
  nextAppointment: null,
  followUps: [],
  agedStock: [],
  awaitingApproval: [],
  overdueInvoices: [],
};

function ageInDays(iso: string | null | undefined) {
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / 86_400_000);
}

export async function getTodayFocus(): Promise<TodayFocus> {
  if (!isSupabaseConfigured()) return EMPTY;
  const staff = await getStaffContext();
  if (!staff) return EMPTY;

  const supabase = createAdminSupabaseClient();
  const twoDaysAgo = addHours(new Date(), -48).toISOString();
  const timezone = "Europe/London";

  const [nextApptResult, staleLeadsResult, agedStockResult, approvalsResult, overdueInvoicesResult] =
    await Promise.all([
      hasPermission(staff.role, "diary:view")
        ? supabase
            .from("appointments")
            .select(
              "id,starts_at,reason_for_call,registration,customers(full_name)",
            )
            .eq("organisation_id", staff.organisationId)
            .is("deleted_at", null)
            .gt("starts_at", new Date().toISOString())
            .not("status", "in", '("cancelled","closed","no_show")')
            .order("starts_at", { ascending: true })
            .limit(1)
        : Promise.resolve({ data: [], error: null }),

      hasPermission(staff.role, "leads:view")
        ? supabase
            .from("leads")
            .select("id,title,status,created_at,customers(full_name)")
            .eq("organisation_id", staff.organisationId)
            .is("deleted_at", null)
            .in("status", ["new", "contact_attempted"])
            .lt("created_at", twoDaysAgo)
            .order("created_at", { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),

      hasPermission(staff.role, "stock:view")
        ? supabase
            .from("vehicles")
            .select("id,make,model,registration,acquired_at,created_at")
            .eq("organisation_id", staff.organisationId)
            .is("deleted_at", null)
            .in("status", ["on_forecourt", "ready_for_sale"])
            .order("acquired_at", { ascending: true, nullsFirst: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),

      hasPermission(staff.role, "repairs:view")
        ? supabase
            .from("repair_jobs")
            .select("id,reference,registration,vehicle_make_model,approval_recorded_at,customers(full_name)")
            .eq("organisation_id", staff.organisationId)
            .is("deleted_at", null)
            .eq("approval_status", "requested")
            .order("approval_recorded_at", { ascending: true, nullsFirst: true })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),

      hasPermission(staff.role, "invoices:view")
        ? supabase
            .from("invoices")
            .select(
              "id,invoice_number,customer_name_snapshot,balance,due_at,status",
            )
            .eq("organisation_id", staff.organisationId)
            .is("deleted_at", null)
            .in("status", ["sent", "partially_paid", "overdue"])
            .lt("due_at", new Date().toISOString())
            .gt("balance", 0)
            .order("due_at", { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const nextAppointment = ((nextApptResult.data ?? [])[0] ?? null) as
    | {
        id: string;
        starts_at: string;
        reason_for_call: string | null;
        registration: string | null;
        customers?: { full_name: string | null } | { full_name: string | null }[];
      }
    | null;

  let nextAppointmentItem: TodayFocusItem | null = null;
  if (nextAppointment) {
    const customer = Array.isArray(nextAppointment.customers)
      ? nextAppointment.customers[0]
      : nextAppointment.customers;
    const when = formatInTimeZone(
      new Date(nextAppointment.starts_at),
      timezone,
      "EEE d MMM · HH:mm",
    );
    const relative = formatDistanceToNowStrict(
      new Date(nextAppointment.starts_at),
      { addSuffix: true },
    );
    nextAppointmentItem = {
      id: nextAppointment.id,
      href: `/admin/diary?appointment=${nextAppointment.id}`,
      title:
        customer?.full_name ??
        nextAppointment.reason_for_call ??
        "Upcoming appointment",
      detail: `${when} · ${relative}${nextAppointment.registration ? ` · ${nextAppointment.registration}` : ""}`,
      emphasis: "info",
    };
  }

  const followUps: TodayFocusItem[] = (staleLeadsResult.data ?? []).map(
    (lead) => {
      const customer = Array.isArray(lead.customers)
        ? lead.customers[0]
        : lead.customers;
      const days = ageInDays(lead.created_at as string);
      return {
        id: String(lead.id),
        href: `/admin/leads/${lead.id}`,
        title: (customer as { full_name?: string } | null)?.full_name ??
          String(lead.title ?? "Enquiry"),
        detail: `Waiting ${days} day${days === 1 ? "" : "s"} — ${String(lead.status).replaceAll("_", " ")}`,
        emphasis: days >= 5 ? "critical" : "warning",
      };
    },
  );

  const agedStock: TodayFocusItem[] = ((agedStockResult.data ?? []) as Array<{
    id: string;
    make: string | null;
    model: string | null;
    registration: string | null;
    acquired_at: string | null;
    created_at: string;
  }>)
    .map((vehicle) => ({
      vehicle,
      days: ageInDays(vehicle.acquired_at ?? vehicle.created_at),
    }))
    .filter((entry) => entry.days >= 60)
    .map((entry) => ({
      id: entry.vehicle.id,
      href: `/admin/stock/${entry.vehicle.id}`,
      title: `${entry.vehicle.make ?? ""} ${entry.vehicle.model ?? ""}`.trim() ||
        (entry.vehicle.registration ?? "Vehicle"),
      detail: `${entry.days} days in stock${entry.vehicle.registration ? ` · ${entry.vehicle.registration}` : ""}`,
      emphasis: entry.days >= 90 ? "critical" : "warning",
    }));

  const awaitingApproval: TodayFocusItem[] = (approvalsResult.data ?? []).map(
    (job) => {
      const customer = Array.isArray(job.customers)
        ? job.customers[0]
        : job.customers;
      const days = ageInDays(job.approval_recorded_at as string | null);
      return {
        id: String(job.id),
        href: `/admin/repairs/${job.id}`,
        title: (customer as { full_name?: string } | null)?.full_name ??
          String(job.vehicle_make_model ?? job.reference),
        detail: `Estimate sent ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}${job.registration ? ` · ${job.registration}` : ""}`,
        emphasis: days >= 3 ? "warning" : "info",
      };
    },
  );

  const overdueInvoices: TodayFocusItem[] = (overdueInvoicesResult.data ?? []).map(
    (invoice) => {
      const days = ageInDays(invoice.due_at as string);
      return {
        id: String(invoice.id),
        href: `/admin/invoices/${invoice.id}`,
        title: String(invoice.customer_name_snapshot ?? invoice.invoice_number),
        detail: `${String(invoice.invoice_number)} · £${Number(invoice.balance).toFixed(2)} · ${days} day${days === 1 ? "" : "s"} overdue`,
        emphasis: days >= 14 ? "critical" : "warning",
      };
    },
  );

  return {
    nextAppointment: nextAppointmentItem,
    followUps,
    agedStock,
    awaitingApproval,
    overdueInvoices,
  };
}
