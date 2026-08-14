import "server-only";

import { notFound, redirect } from "next/navigation";

import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { resolvePlatformAdminAccess } from "@/lib/auth/platform-admin-policy";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PlatformAdminContext = {
  userId: string;
  email: string;
  source: "database" | "environment";
  canManage: boolean;
};

function parseWhitelist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getPlatformAdmin(): Promise<PlatformAdminContext | null> {
  const env = getServerEnv();
  const whitelist = parseWhitelist(env.PLATFORM_ADMIN_EMAILS);
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const storedRole = await supabase
    .from("platform_admins")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const access = resolvePlatformAdminAccess({
    storedStatus: storedRole.data?.status,
    emailAllowlisted: whitelist.has(user.email.toLowerCase()),
  });
  if (!access) return null;

  // PLATFORM_ADMIN_EMAILS is retained only as a migration/bootstrap path.
  // The policy helper keeps that access read-only and gives a suspended
  // database row precedence over a stale environment value.
  return {
    userId: user.id,
    email: user.email,
    ...access,
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

export { redirect };
