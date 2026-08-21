import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canMutatePlatform, getPlatformAdmin } from "@/lib/auth/platform-admin";
import { changePlatformDomainStatus } from "@/lib/data/platform-admin";
import { assertSameOrigin } from "@/lib/security/request";

import { platformDomainActionSchema } from "../../../schema";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; domainId: string }> },
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
  const { id, domainId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(domainId).success) {
    return NextResponse.json({ message: "Invalid domain ID." }, { status: 400 });
  }
  const parsed = platformDomainActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "A reason and explicit confirmation are required." },
      { status: 400 },
    );
  }
  try {
    await changePlatformDomainStatus({
      organisationId: id,
      domainId,
      actor,
      status: parsed.data.status,
      reason: parsed.data.reason,
    });
    revalidatePath("/platform");
    revalidatePath(`/platform/dealerships/${id}`);
    return NextResponse.json({ ok: true, message: "Domain status saved and audited." });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "The domain could not be updated.",
      },
      { status: 500 },
    );
  }
}
