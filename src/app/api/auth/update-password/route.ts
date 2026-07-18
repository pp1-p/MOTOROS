import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/security/request";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z
  .object({
    password: z
      .string()
      .min(12)
      .max(128)
      .regex(/[a-z]/, "Use a lowercase letter.")
      .regex(/[A-Z]/, "Use an uppercase letter.")
      .regex(/[0-9]/, "Use a number.")
      .regex(/[^A-Za-z0-9]/, "Use a symbol."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Use a strong password." },
      { status: 400 },
    );
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { message: "This reset link has expired. Request a new one." },
      { status: 401 },
    );
  }
  const update = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (update.error) {
    return NextResponse.json(
      { message: "The password could not be updated. Request a new reset link." },
      { status: 422 },
    );
  }
  return NextResponse.json({
    ok: true,
    message: "Password updated.",
    redirectTo: "/admin",
  });
}
