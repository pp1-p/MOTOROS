import { NextResponse } from "next/server";

import { sendConfirmationEmail } from "@/lib/communications/email";
import { getDefaultOrganisationId } from "@/lib/data/organisation";
import { saveDemoSubmission, isDevelopmentDemoMode } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/security/logger";
import {
  assertSameOrigin,
  checkRateLimit,
  getClientFingerprint,
} from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { enquirySchema } from "@/lib/validation/public";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const rate = checkRateLimit(`enquiry:${getClientFingerprint(request)}`, {
    limit: 6,
    windowMs: 15 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Please wait before sending another enquiry." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const parsed = enquirySchema.safeParse(await request.json().catch(() => null));
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
    return NextResponse.json({ ok: true, message: "Thank you. We have your enquiry." });
  }

  try {
    if (!isSupabaseConfigured() && isDevelopmentDemoMode()) {
      const saved = saveDemoSubmission("lead", parsed.data);
      return NextResponse.json({
        ok: saved.ok,
        message: "Thank you. A member of the team will be in touch.",
        reference: saved.ok ? saved.submission.id.slice(0, 8).toUpperCase() : undefined,
      });
    }

    const organisationId = await getDefaultOrganisationId();
    const supabase = createAdminSupabaseClient();
    const submission = await supabase.rpc("submit_public_enquiry", {
      p_organisation_id: organisationId,
      p_payload: parsed.data,
    });
    if (submission.error || !submission.data) {
      throw new Error(submission.error?.message ?? "Atomic lead submission failed.");
    }
    const leadId = (submission.data as { lead_id?: string }).lead_id;
    if (!leadId) throw new Error("Lead submission returned no reference.");

    await sendConfirmationEmail({
      to: parsed.data.email,
      subject: "We have received your enquiry",
      text: `Hello ${parsed.data.name},\n\nThank you for contacting us. A member of the dealership team will review your enquiry and get in touch using your preferred contact method.\n\nReference: ${leadId.slice(0, 8).toUpperCase()}`,
    });

    return NextResponse.json({
      ok: true,
      message: "Thank you. A member of the team will be in touch.",
      reference: leadId.slice(0, 8).toUpperCase(),
    });
  } catch (error) {
    log("error", "public_enquiry.failed", {
      message: error instanceof Error ? error.message : "Unknown failure",
    });
    return NextResponse.json(
      {
        message:
          "We could not safely save your enquiry. Nothing has been silently discarded—please try again or telephone the dealership.",
      },
      { status: 503 },
    );
  }
}
