import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canMutatePlatform, getPlatformAdmin } from "@/lib/auth/platform-admin";
import {
  changePlatformDealershipPlan,
  changePlatformDealershipStatus,
  changePlatformTheme,
  changePlatformWebsiteStatus,
} from "@/lib/data/platform-admin";
import { assertSameOrigin } from "@/lib/security/request";

import { platformDealershipActionSchema } from "../schema";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid dealership ID." }, { status: 400 });
  }
  const parsed = platformDealershipActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "A reason and explicit confirmation are required.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    switch (parsed.data.action) {
      case "status":
        await changePlatformDealershipStatus({
          organisationId: id,
          actor,
          status: parsed.data.status,
          reason: parsed.data.reason,
        });
        break;
      case "plan":
        await changePlatformDealershipPlan({
          organisationId: id,
          actor,
          planCode: parsed.data.planCode,
          reason: parsed.data.reason,
        });
        break;
      case "website_status":
        await changePlatformWebsiteStatus({
          organisationId: id,
          actor,
          websiteStatus: parsed.data.websiteStatus,
          reason: parsed.data.reason,
        });
        break;
      case "theme":
        await changePlatformTheme({
          organisationId: id,
          actor,
          themeId: parsed.data.themeId,
          mode: parsed.data.mode,
          reason: parsed.data.reason,
        });
        break;
    }
    revalidatePath("/platform");
    revalidatePath(`/platform/dealerships/${id}`);
    return NextResponse.json({ ok: true, message: "Platform change saved and audited." });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The platform change could not be saved.",
      },
      { status: 500 },
    );
  }
}
