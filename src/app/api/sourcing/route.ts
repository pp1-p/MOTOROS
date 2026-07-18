import { NextResponse } from "next/server";

import { sendConfirmationEmail } from "@/lib/communications/email";
import { getDefaultOrganisationId } from "@/lib/data/organisation";
import { isDevelopmentDemoMode, saveDemoSubmission } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/security/logger";
import {
  assertSameOrigin,
  checkRateLimit,
  getClientFingerprint,
} from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sourcingSchema } from "@/lib/validation/public";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const rate = checkRateLimit(`sourcing:${getClientFingerprint(request)}`, {
    limit: 4,
    windowMs: 30 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Please wait before sending another sourcing request." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const parsed = sourcingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Please check the highlighted details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  if (parsed.data.website) {
    return NextResponse.json({ ok: true, message: "Your request has been received." });
  }

  try {
    if (!isSupabaseConfigured() && isDevelopmentDemoMode()) {
      const saved = saveDemoSubmission("sourcing", parsed.data);
      return NextResponse.json({
        ok: saved.ok,
        message: "Your sourcing brief is now with our team.",
        reference: saved.ok ? saved.submission.id.slice(0, 8).toUpperCase() : undefined,
      });
    }

    const organisationId = await getDefaultOrganisationId();
    const supabase = createAdminSupabaseClient();
    const submission = await supabase.rpc("submit_public_sourcing_request", {
      p_organisation_id: organisationId,
      p_payload: parsed.data,
    });
    if (submission.error || !submission.data) {
      throw new Error(
        submission.error?.message ?? "Atomic sourcing submission failed.",
      );
    }
    const sourcingId = (
      submission.data as { sourcing_request_id?: string }
    ).sourcing_request_id;
    if (!sourcingId) throw new Error("Sourcing submission returned no reference.");

    await sendConfirmationEmail({
      to: parsed.data.email,
      subject: "Your car-sourcing brief is with our team",
      text: `Hello ${parsed.data.name},\n\nWe have received your brief for a ${parsed.data.make} ${parsed.data.model}. We will review it and contact you before we begin a search.\n\nReference: ${sourcingId.slice(0, 8).toUpperCase()}`,
    });

    return NextResponse.json({
      ok: true,
      message: "Your sourcing brief is now with our team.",
      reference: sourcingId.slice(0, 8).toUpperCase(),
    });
  } catch (error) {
    log("error", "public_sourcing.failed", {
      message: error instanceof Error ? error.message : "Unknown failure",
    });
    return NextResponse.json(
      {
        message:
          "We could not safely save your request. Please try again or telephone the dealership.",
      },
      { status: 503 },
    );
  }
}
