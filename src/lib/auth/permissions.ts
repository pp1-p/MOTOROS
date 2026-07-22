import "server-only";

import { redirect } from "next/navigation";

import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/types";

export type Permission =
  | "dashboard:view"
  | "stock:view"
  | "stock:manage"
  | "commercial:view"
  | "leads:view"
  | "leads:manage"
  | "sourcing:view"
  | "sourcing:manage"
  | "repairs:view"
  | "repairs:manage"
  | "technician:update"
  | "customers:view"
  | "customers:manage"
  | "diary:view"
  | "diary:manage"
  | "documents:view"
  | "documents:manage"
  | "invoices:view"
  | "invoices:manage"
  | "invoices:record_payment"
  | "invoices:issue_credit"
  | "reports:view"
  | "website:manage"
  | "team:manage"
  | "settings:manage"
  | "integrations:manage"
  | "audit:view";

const allPermissions: Permission[] = [
  "dashboard:view",
  "stock:view",
  "stock:manage",
  "commercial:view",
  "leads:view",
  "leads:manage",
  "sourcing:view",
  "sourcing:manage",
  "repairs:view",
  "repairs:manage",
  "technician:update",
  "customers:view",
  "customers:manage",
  "diary:view",
  "diary:manage",
  "documents:view",
  "documents:manage",
  "invoices:view",
  "invoices:manage",
  "invoices:record_payment",
  "invoices:issue_credit",
  "reports:view",
  "website:manage",
  "team:manage",
  "settings:manage",
  "integrations:manage",
  "audit:view",
];

export const rolePermissions: Record<StaffRole, readonly Permission[]> = {
  owner: allPermissions,
  manager: allPermissions.filter(
    (permission) =>
      !["team:manage", "integrations:manage", "audit:view"].includes(permission),
  ),
  salesperson: [
    "dashboard:view",
    "stock:view",
    "leads:view",
    "leads:manage",
    "sourcing:view",
    "customers:view",
    "customers:manage",
    "diary:view",
    "diary:manage",
    "documents:view",
    "documents:manage",
    "invoices:view",
    "invoices:manage",
  ],
  service_advisor: [
    "dashboard:view",
    "stock:view",
    "repairs:view",
    "repairs:manage",
    "customers:view",
    "customers:manage",
    "diary:view",
    "diary:manage",
    "documents:view",
    "documents:manage",
    "invoices:view",
  ],
  technician: [
    "repairs:view",
    "technician:update",
    "documents:view",
    "documents:manage",
  ],
  website_editor: ["stock:view", "website:manage"],
};

export type StaffContext = {
  userId: string;
  email: string | null;
  organisationId: string;
  organisationName: string;
  role: StaffRole;
  displayName: string;
};

export function hasPermission(role: StaffRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export async function getStaffContext(): Promise<StaffContext | null> {
  const env = getServerEnv();

  if (!isSupabaseConfigured()) {
    if (env.DEALEROS_DEMO_MODE === "true" && process.env.NODE_ENV !== "production") {
      return {
        userId: "00000000-0000-0000-0000-000000000001",
        email: "owner@dealeros.local",
        organisationId: "00000000-0000-0000-0000-000000000001",
        organisationName: "DealerOS",
        role: "owner",
        displayName: "Alex Morgan",
      };
    }
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("organisation_members")
    .select(
      "organisation_id, role, organisations(name), profiles(display_name)",
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const organisation = Array.isArray(data.organisations)
    ? data.organisations[0]
    : data.organisations;
  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

  return {
    userId: user.id,
    email: user.email ?? null,
    organisationId: data.organisation_id as string,
    organisationName:
      (organisation as { name?: string } | null)?.name ?? "DealerOS",
    role: data.role as StaffRole,
    displayName:
      (profile as { display_name?: string } | null)?.display_name ??
      user.email?.split("@")[0] ??
      "Team member",
  };
}

export async function requireStaff(permission?: Permission) {
  const context = await getStaffContext();
  if (!context) redirect("/admin/sign-in");
  if (permission && !hasPermission(context.role, permission)) {
    redirect("/admin/forbidden");
  }
  return context;
}
