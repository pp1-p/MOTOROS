import "server-only";

import {
  customers as demoCustomers,
  leads as demoLeads,
  repairJobs as demoRepairJobs,
  sourcingRequests as demoSourcingRequests,
  vehicles as demoVehicles,
} from "@/components/admin/admin-data";
import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/security/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminSearchResult = {
  type: "vehicle" | "customer" | "lead" | "repair" | "sourcing";
  id: string;
  title: string;
  detail: string;
  href: string;
};

export type AdminSearchResponse = {
  state: "live" | "demo" | "unavailable";
  message: string | null;
  query: string;
  results: AdminSearchResult[];
};

export function normaliseAdminSearchQuery(value: string) {
  return value
    .slice(0, 100)
    .replace(/[^\p{L}\p{N}@.+\- ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function demoSearch(query: string): AdminSearchResult[] {
  const results: AdminSearchResult[] = [
    ...demoVehicles.map((vehicle) => ({
      type: "vehicle" as const,
      id: vehicle.id,
      title: `${vehicle.registration} · ${vehicle.title}`,
      detail: `Vehicle · ${vehicle.stockNumber}`,
      href: `/admin/stock/${vehicle.id}`,
    })),
    ...demoCustomers.map((customer) => ({
      type: "customer" as const,
      id: customer.id,
      title: customer.name,
      detail: `Customer · ${customer.email} · ${customer.phone}`,
      href: `/admin/customers/${customer.id}`,
    })),
    ...demoLeads.map((lead) => ({
      type: "lead" as const,
      id: lead.id,
      title: `${lead.id} · ${lead.name}`,
      detail: `${lead.source} · ${lead.subject}`,
      href: `/admin/leads?query=${encodeURIComponent(lead.id)}`,
    })),
    ...demoRepairJobs.map((job) => ({
      type: "repair" as const,
      id: job.id,
      title: `${job.id} · ${job.vehicle}`,
      detail: `Repair · ${job.registration} · ${job.customer}`,
      href: `/admin/repairs/${job.id}`,
    })),
    ...demoSourcingRequests.map((request) => ({
      type: "sourcing" as const,
      id: request.id,
      title: `${request.id} · ${request.customer}`,
      detail: request.brief,
      href: `/admin/sourcing?query=${encodeURIComponent(request.id)}`,
    })),
  ];
  const needle = query.toLocaleLowerCase("en-GB");
  return results
    .filter((result) =>
      `${result.title} ${result.detail}`
        .toLocaleLowerCase("en-GB")
        .includes(needle),
    )
    .slice(0, 30);
}

export async function searchAdminRecords(
  rawQuery: string,
): Promise<AdminSearchResponse> {
  const query = normaliseAdminSearchQuery(rawQuery);
  if (!isSupabaseConfigured()) {
    return isDevelopmentDemoMode()
      ? {
          state: "demo",
          message: "Development demo results are shown.",
          query,
          results: query.length >= 2 ? demoSearch(query) : [],
        }
      : {
          state: "unavailable",
          message: "Search is unavailable until Supabase is configured.",
          query,
          results: [],
        };
  }
  if (query.length < 2) {
    return { state: "live", message: null, query, results: [] };
  }

  const staff = await getStaffContext();
  if (!staff) {
    return {
      state: "unavailable",
      message: "An active dealership membership is required.",
      query,
      results: [],
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const results: AdminSearchResult[] = [];
    const requests: PromiseLike<void>[] = [];

    if (hasPermission(staff.role, "stock:view")) {
      requests.push(
        supabase
          .from("staff_vehicle_records")
          .select("id,registration,stock_number,public_title,make,model")
          .eq("organisation_id", staff.organisationId)
          .is("deleted_at", null)
          .or(
            `registration.ilike.%${query}%,stock_number.ilike.%${query}%,make.ilike.%${query}%,model.ilike.%${query}%`,
          )
          .limit(8)
          .then(({ data, error }) => {
            if (error) throw error;
            results.push(
              ...(data ?? []).map((vehicle) => ({
                type: "vehicle" as const,
                id: vehicle.id,
                title:
                  vehicle.public_title ??
                  [vehicle.make, vehicle.model].filter(Boolean).join(" "),
                detail: [vehicle.registration, vehicle.stock_number]
                  .filter(Boolean)
                  .join(" · "),
                href: `/admin/stock/${vehicle.id}`,
              })),
            );
          }),
      );
    }
    if (hasPermission(staff.role, "customers:view")) {
      requests.push(
        supabase
          .from("customers")
          .select("id,full_name,email,phone")
          .eq("organisation_id", staff.organisationId)
          .is("deleted_at", null)
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
          .limit(8)
          .then(({ data, error }) => {
            if (error) throw error;
            results.push(
              ...(data ?? []).map((customer) => ({
                type: "customer" as const,
                id: customer.id,
                title: customer.full_name,
                detail: customer.email ?? customer.phone ?? "No contact detail",
                href: `/admin/customers/${customer.id}`,
              })),
            );
          }),
      );
    }
    if (hasPermission(staff.role, "leads:view")) {
      requests.push(
        supabase
          .from("leads")
          .select("id,reference,title,status")
          .eq("organisation_id", staff.organisationId)
          .is("deleted_at", null)
          .or(`reference.ilike.%${query}%,title.ilike.%${query}%`)
          .limit(8)
          .then(({ data, error }) => {
            if (error) throw error;
            results.push(
              ...(data ?? []).map((lead) => ({
                type: "lead" as const,
                id: lead.id,
                title: `${lead.reference} · ${lead.title}`,
                detail: String(lead.status).replaceAll("_", " "),
                href: `/admin/leads?query=${encodeURIComponent(lead.reference)}`,
              })),
            );
          }),
      );
    }
    if (hasPermission(staff.role, "repairs:view")) {
      requests.push(
        supabase
          .from("repair_jobs")
          .select("id,reference,registration,vehicle_make_model,status,assigned_technician_id")
          .eq("organisation_id", staff.organisationId)
          .is("deleted_at", null)
          .or(
            `reference.ilike.%${query}%,registration.ilike.%${query}%,vehicle_make_model.ilike.%${query}%`,
          )
          .limit(8)
          .then(({ data, error }) => {
            if (error) throw error;
            const visible =
              staff.role === "technician"
                ? (data ?? []).filter(
                    (job) => job.assigned_technician_id === staff.userId,
                  )
                : (data ?? []);
            results.push(
              ...visible.map((job) => ({
                type: "repair" as const,
                id: job.id,
                title: `${job.reference} · ${job.vehicle_make_model ?? "Repair job"}`,
                detail: [job.registration, String(job.status).replaceAll("_", " ")]
                  .filter(Boolean)
                  .join(" · "),
                href: `/admin/repairs/${job.id}`,
              })),
            );
          }),
      );
    }
    if (hasPermission(staff.role, "sourcing:view")) {
      requests.push(
        supabase
          .from("sourcing_requests")
          .select("id,reference,preferred_make,preferred_model,status")
          .eq("organisation_id", staff.organisationId)
          .is("deleted_at", null)
          .or(
            `reference.ilike.%${query}%,preferred_make.ilike.%${query}%,preferred_model.ilike.%${query}%`,
          )
          .limit(8)
          .then(({ data, error }) => {
            if (error) throw error;
            results.push(
              ...(data ?? []).map((request) => ({
                type: "sourcing" as const,
                id: request.id,
                title: `${request.reference} · ${[request.preferred_make, request.preferred_model].filter(Boolean).join(" ") || "Sourcing request"}`,
                detail: String(request.status).replaceAll("_", " "),
                href: `/admin/sourcing?query=${encodeURIComponent(request.reference)}`,
              })),
            );
          }),
      );
    }

    await Promise.all(requests);
    return {
      state: "live",
      message: null,
      query,
      results: results.slice(0, 30),
    };
  } catch (error) {
    log("error", "admin_search.failed", {
      message: error instanceof Error ? error.message : "Unknown search failure",
    });
    return {
      state: "unavailable",
      message: "Live search could not be completed. Try again or check System health.",
      query,
      results: [],
    };
  }
}
