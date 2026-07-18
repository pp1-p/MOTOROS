import { NextResponse } from "next/server";

import { getAvailableRepairCallSlots } from "@/lib/availability";
import {
  checkRateLimit,
  getClientFingerprint,
} from "@/lib/security/request";
import { availabilityRequestSchema } from "@/lib/validation/public";

export async function POST(request: Request) {
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
    const slots = await getAvailableRepairCallSlots(parsed.data.date);
    return NextResponse.json({ slots });
  } catch {
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
