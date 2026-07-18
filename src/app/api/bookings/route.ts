import { addMinutes } from "date-fns";
import { NextResponse } from "next/server";

import { getAvailableRepairCallSlots } from "@/lib/availability";
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
import { bookingSchema } from "@/lib/validation/public";

const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 8 * 1024 * 1024;

function validPhotoSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }
  if (mimeType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const rate = checkRateLimit(`booking:${getClientFingerprint(request)}`, {
    limit: 5,
    windowMs: 30 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Please wait before making another booking request." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ message: "Invalid booking form." }, { status: 400 });
  }

  const photo = formData.get("photo");
  const raw = Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key !== "photo")
      .map(([key, value]) => [key, String(value)]),
  );
  const parsed = bookingSchema.safeParse({
    ...raw,
    consent: raw.consent === "true" || raw.consent === "on",
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Please check the highlighted details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  if (
    photo instanceof File &&
    photo.size > 0 &&
    (!allowedPhotoTypes.has(photo.type) || photo.size > maxPhotoBytes)
  ) {
    return NextResponse.json(
      { message: "Photos must be JPG, PNG or WebP and no larger than 8 MB." },
      { status: 400 },
    );
  }
  if (photo instanceof File && photo.size > 0) {
    const bytes = new Uint8Array(await photo.arrayBuffer());
    if (!validPhotoSignature(bytes, photo.type)) {
      return NextResponse.json(
        { message: "The photo contents do not match its image type." },
        { status: 400 },
      );
    }
  }

  if (parsed.data.website) {
    return NextResponse.json({ ok: true, message: "Your call request is booked." });
  }

  try {
    const available = await getAvailableRepairCallSlots(parsed.data.preferredDate);
    const selected = available.find((slot) => slot.start === parsed.data.timeSlot);
    if (!selected) {
      return NextResponse.json(
        {
          message:
            "That time is no longer available. Please choose another available slot.",
          code: "slot_unavailable",
        },
        { status: 409 },
      );
    }

    if (!isSupabaseConfigured() && isDevelopmentDemoMode()) {
      const saved = saveDemoSubmission("booking", parsed.data);
      if (!saved.ok) {
        return NextResponse.json(
          { message: "That time has just been booked. Please choose another slot." },
          { status: 409 },
        );
      }
      return NextResponse.json({
        ok: true,
        message: "Your repair discussion call is requested.",
        reference: saved.submission.id.slice(0, 8).toUpperCase(),
      });
    }

    const organisationId = await getDefaultOrganisationId();
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.rpc("book_repair_call", {
      p_organisation_id: organisationId,
      p_starts_at: selected.start,
      p_name: parsed.data.name,
      p_email: parsed.data.email,
      p_phone: parsed.data.phone,
      p_preferred_contact: parsed.data.preferredContact,
      p_reason: parsed.data.reason,
      p_registration: parsed.data.registration,
      p_make_model: parsed.data.makeModel,
      p_fault_description: parsed.data.faultDescription,
      p_warning_lights: parsed.data.warningLights,
      p_driveable: parsed.data.driveable,
    });

    if (error || !data) {
      const conflict =
        error?.code === "23P01" ||
        error?.code === "23505" ||
        error?.message?.toLowerCase().includes("slot");
      return NextResponse.json(
        {
          message: conflict
            ? "That time has just been booked. Please choose another slot."
            : "We could not safely reserve that time. Please try again.",
          code: conflict ? "slot_unavailable" : "booking_failed",
        },
        { status: conflict ? 409 : 503 },
      );
    }

    const result =
      typeof data === "object" && data !== null
        ? (data as { appointment_id?: string })
        : {};
    const appointmentId = result.appointment_id;

    let attachmentWarning: string | undefined;
    if (photo instanceof File && photo.size > 0 && appointmentId) {
      const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      const path = `${organisationId}/repair-bookings/${appointmentId}/${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage
        .from("private-documents")
        .upload(path, photo, { contentType: photo.type, upsert: false });
      if (!upload.error) {
        const document = await supabase.from("documents").insert({
          organisation_id: organisationId,
          entity_type: "appointment",
          entity_id: appointmentId,
          file_name: photo.name.slice(0, 200),
          storage_bucket: "private-documents",
          storage_path: path,
          mime_type: photo.type,
          size_bytes: photo.size,
          visibility: "private",
        });
        if (document.error) {
          await supabase.storage.from("private-documents").remove([path]);
          attachmentWarning =
            "Your call was reserved, but the photo could not be attached. Please share it with the service adviser.";
        }
      } else {
        attachmentWarning =
          "Your call was reserved, but the photo could not be attached. Please share it with the service adviser.";
      }
    }

    await sendConfirmationEmail({
      to: parsed.data.email,
      subject: "Your repair discussion call request",
      text: `Hello ${parsed.data.name},\n\nWe have reserved your requested call time. This is a telephone discussion and not a confirmed workshop appointment.\n\nRequested time: ${new Date(selected.start).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "full", timeStyle: "short" })}\nReference: ${String(appointmentId ?? "").slice(0, 8).toUpperCase()}`,
    });

    return NextResponse.json({
      ok: true,
      message: "Your repair discussion call is requested.",
      reference: String(appointmentId ?? "").slice(0, 8).toUpperCase(),
      endsAt: addMinutes(new Date(selected.start), 30).toISOString(),
      attachmentWarning,
    });
  } catch (error) {
    log("error", "repair_booking.failed", {
      message: error instanceof Error ? error.message : "Unknown failure",
    });
    return NextResponse.json(
      {
        message:
          "We could not safely save your booking. Please try again or telephone the dealership.",
      },
      { status: 503 },
    );
  }
}
