import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { assertSameOrigin } from "@/lib/security/request";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (isSupabaseConfigured()) {
      const supabase = await createServerSupabaseClient();
      await supabase.auth.signOut();
    }
    return NextResponse.json({ ok: true, redirectTo: "/admin/sign-in" });
  } catch {
    return NextResponse.json({ message: "Sign out failed." }, { status: 400 });
  }
}
