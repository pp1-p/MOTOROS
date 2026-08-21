import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canMutatePlatform, getPlatformAdmin } from "@/lib/auth/platform-admin";
import { invitePlatformDealershipOwner } from "@/lib/data/platform-admin";
import { assertSameOrigin } from "@/lib/security/request";

import { platformOwnerInvitationSchema } from "../../schema";

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
  const parsed = platformOwnerInvitationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "A valid email and explicit confirmation are required." },
      { status: 400 },
    );
  }
  try {
    const invitation = await invitePlatformDealershipOwner({
      organisationId: id,
      ownerEmail: parsed.data.email,
      actor,
    });
    revalidatePath(`/platform/dealerships/${id}`);
    return NextResponse.json(
      {
        ok: invitation.sent,
        message: invitation.warning ?? "Owner invitation sent and audited.",
        warning: invitation.warning,
      },
      { status: invitation.sent ? 201 : 502 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The owner invitation could not be sent.",
      },
      { status: 500 },
    );
  }
}
