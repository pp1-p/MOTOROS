import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (
    !value ||
    (value !== "/admin" && !value.startsWith("/admin/")) ||
    value.includes("\\")
  ) {
    return "/admin";
  }
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/sign-in?error=invalid-invitation", requestUrl.origin),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/admin/sign-in?error=expired-invitation", requestUrl.origin),
    );
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
