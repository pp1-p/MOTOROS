import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { canMutatePlatform, getPlatformAdmin } from "@/lib/auth/platform-admin";
import { createPlatformDealership } from "@/lib/data/platform-admin";
import { assertSameOrigin } from "@/lib/security/request";

import { createPlatformDealershipSchema } from "./schema";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const actor = await getPlatformAdmin();
  if (!actor) return NextResponse.json({ message: "Not found." }, { status: 404 });
  if (!canMutatePlatform(actor.role)) {
    return NextResponse.json(
      { message: "Platform support access is read-only." },
      { status: 403 },
    );
  }

  const parsed = createPlatformDealershipSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Review the dealership onboarding details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await createPlatformDealership({
      dealership: parsed.data,
      actor,
    });
    revalidatePath("/platform");
    return NextResponse.json(
      {
        ok: true,
        message: result.invitationWarning
          ? `Dealership created. ${result.invitationWarning}`
          : "Dealership created and onboarding completed.",
        dealershipId: result.id,
        redirectTo: `/platform/dealerships/${result.id}`,
        warning: result.invitationWarning,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The dealership could not be created.",
      },
      { status: 500 },
    );
  }
}
