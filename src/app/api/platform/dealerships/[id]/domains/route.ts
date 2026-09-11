import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canMutatePlatform, getPlatformAdmin } from "@/lib/auth/platform-admin";
import { addPlatformCustomDomain } from "@/lib/data/platform-domains";
import { assertSameOrigin } from "@/lib/security/request";

import { platformCustomDomainCreateSchema } from "../../schema";

export async function POST(
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

  const parsed = platformCustomDomainCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "A valid hostname, reason and explicit confirmation are required." },
      { status: 400 },
    );
  }

  try {
    const domain = await addPlatformCustomDomain({
      organisationId: id,
      actor,
      hostname: parsed.data.hostname,
      reason: parsed.data.reason,
    });
    revalidatePath("/platform");
    revalidatePath(`/platform/dealerships/${id}`);
    return NextResponse.json({
      ok: true,
      domain,
      message: "Custom domain added as pending. Run the Vercel check to provision and verify it.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "The custom domain could not be added.",
      },
      { status: 500 },
    );
  }
}
