import { NextResponse } from "next/server";

import { getAvailableRepairCallSlots } from "@/lib/availability";
import {
  assertSameOrigin,
  checkRateLimit,
  getClientFingerprint,
} from "@/lib/security/request";
import {
  PublicTenantNotFoundError,
  resolvePublicTenantForRequest,
} from "@/lib/tenancy/public-tenant";
import { availabilityRequestSchema } from "@/lib/validation/public";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const rate = checkRateLimit(`availability:${getClientFingerprint(request)}`, {
    limit: 40,
    windowMs: 10 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Too many availability requests. Please wait a moment." },
      { status: 429 },
    );
  }

  const parsed = availabilityRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Choose a valid date.", slots: [] },
      { status: 400 },
    );
  }

  try {
    const tenant = await resolvePublicTenantForRequest(request);
    const slots = await getAvailableRepairCallSlots(
      parsed.data.date,
      tenant.organisationId,
    );
    return NextResponse.json({ slots });
  } catch (error) {
    if (error instanceof PublicTenantNotFoundError) {
      return NextResponse.json(
        { message: "This dealership website is not available.", slots: [] },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        message:
          "Live availability is temporarily unavailable. Please telephone the dealership.",
        slots: [],
      },
      { status: 503 },
    );
  }
}
