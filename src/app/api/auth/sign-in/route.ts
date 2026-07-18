import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env";
import { assertSameOrigin, checkRateLimit, getClientFingerprint } from "@/lib/security/request";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const rate = checkRateLimit(`sign-in:${getClientFingerprint(request)}`, {
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Too many sign-in attempts. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter a valid email address and password." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        message:
          "Authentication is not configured yet. Add the Supabase environment variables.",
      },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return NextResponse.json(
      { message: "The email address or password was not recognised." },
      { status: 401 },
    );
  }

  const membership = data.user
    ? await supabase
        .from("organisation_members")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
    : null;
  const role = membership?.data?.role;
  const redirectTo =
    role === "technician"
      ? "/admin/repairs"
      : role === "website_editor"
        ? "/admin/website"
        : "/admin";

  return NextResponse.json({ ok: true, redirectTo });
}
