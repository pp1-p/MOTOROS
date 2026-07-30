import "server-only";

import { notFound, redirect } from "next/navigation";

import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PlatformAdminContext = {
  userId: string;
  email: string;
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

export function isPlatformAdminEnabled(): boolean {
  return parseWhitelist(getServerEnv().PLATFORM_ADMIN_EMAILS).size > 0;
}

export async function getPlatformAdmin(): Promise<PlatformAdminContext | null> {
  const env = getServerEnv();
  const whitelist = parseWhitelist(env.PLATFORM_ADMIN_EMAILS);
  if (whitelist.size === 0) return null;
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  if (!whitelist.has(user.email.toLowerCase())) return null;

  return { userId: user.id, email: user.email };
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
