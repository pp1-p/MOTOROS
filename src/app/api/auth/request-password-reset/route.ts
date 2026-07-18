import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import {
  assertSameOrigin,
  checkRateLimit,
  getClientFingerprint,
} from "@/lib/security/request";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.email().max(254) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const rate = checkRateLimit(`password-reset:${getClientFingerprint(request)}`, {
    limit: 5,
    windowMs: 30 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Please wait before requesting another reset email." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email.toLowerCase(), {
    redirectTo: `${getServerEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/admin/reset-password")}`,
  });

  return NextResponse.json({
    ok: true,
    message:
      "If that address belongs to an account, a secure reset link is on its way.",
  });
}
