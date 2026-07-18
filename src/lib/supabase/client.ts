"use client";

import { createBrowserClient } from "@supabase/ssr";

function buildBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase browser credentials are not configured.");
  }

  return createBrowserClient(url, key);
}

let client: ReturnType<typeof buildBrowserClient> | undefined;

export function createBrowserSupabaseClient() {
  client ??= buildBrowserClient();
  return client;
}
