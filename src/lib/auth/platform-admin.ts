import "server-only";

import { notFound, redirect } from "next/navigation";

import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PlatformRole = "owner" | "support";

export type PlatformAdminContext = {
  userId: string;
  email: string;
  role: PlatformRole;
  source: "database" | "bootstrap_email";
};

export function parsePlatformBootstrapEmails(
  raw: string | undefined,
): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function resolvePlatformRole(input: {
  databaseAssignment:
    | { role: string | null | undefined; status: string | null | undefined }
    | null
    | undefined;
  email: string | null | undefined;
  bootstrapEmails: ReadonlySet<string>;
}): Pick<PlatformAdminContext, "role" | "source"> | null {
  if (input.databaseAssignment) {
    if (input.databaseAssignment.status !== "active") return null;
    if (
      input.databaseAssignment.role === "owner" ||
      input.databaseAssignment.role === "support"
    ) {
      return { role: input.databaseAssignment.role, source: "database" };
    }
    return null;
  }

  const email = input.email?.trim().toLowerCase();
  if (email && input.bootstrapEmails.has(email)) {
    return { role: "owner", source: "bootstrap_email" };
  }

  return null;
}

export function canMutatePlatform(role: PlatformRole): boolean {
  return role === "owner";
}

export function isPlatformAdminEnabled(): boolean {
  const env = getServerEnv();
  return (
    parsePlatformBootstrapEmails(env.PLATFORM_ADMIN_EMAILS).size > 0 ||
    Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export async function getPlatformAdmin(): Promise<PlatformAdminContext | null> {
  const env = getServerEnv();
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let databaseAssignment: { role: string; status: string } | null = null;
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    const roleResult = await createAdminSupabaseClient()
      .from("platform_user_roles")
      .select("role,status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (roleResult.error) return null;
    if (roleResult.data) {
      databaseAssignment = {
        role: String(roleResult.data.role),
        status: String(roleResult.data.status),
      };
    }
  }

  const resolved = resolvePlatformRole({
    databaseAssignment,
    email: user.email,
    bootstrapEmails: parsePlatformBootstrapEmails(env.PLATFORM_ADMIN_EMAILS),
  });
  if (!resolved) return null;

  return {
    userId: user.id,
    email: user.email ?? "Unavailable",
    role: resolved.role,
    source: resolved.source,
  };
}

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const context = await getPlatformAdmin();
  if (!context) {
    // Fall through to a plain 404 so we don't leak the /platform surface
    // to a staff account that happens to be signed in but not on the list.
    notFound();
  }
  return context;
}

export async function requirePlatformOwner(): Promise<PlatformAdminContext> {
  const context = await requirePlatformAdmin();
  if (!canMutatePlatform(context.role)) notFound();
  return context;
}

export { redirect };
