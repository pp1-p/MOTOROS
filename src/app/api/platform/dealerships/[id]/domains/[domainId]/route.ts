import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canMutatePlatform, getPlatformAdmin } from "@/lib/auth/platform-admin";
import {
  changePlatformDomainStatusSafely,
  provisionPlatformCustomDomain,
} from "@/lib/data/platform-domains";
import { assertSameOrigin } from "@/lib/security/request";

import {
  platformCustomDomainProvisionSchema,
  platformDomainActionSchema,
} from "../../../schema";

async function authorisedPlatformOwner(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return {
      error: NextResponse.json({ message: "Invalid request origin." }, { status: 403 }),
      actor: null,
    };
  }
  const actor = await getPlatformAdmin();
  if (!actor) {
    return {
      error: NextResponse.json({ message: "Not found." }, { status: 404 }),
      actor: null,
    };
  }
  if (!canMutatePlatform(actor.role)) {
    return {
      error: NextResponse.json(
        { message: "Platform support access is read-only." },
        { status: 403 },
      ),
      actor: null,
    };
  }
  return { error: null, actor };
}

function validIds(id: string, domainId: string) {
  return z.uuid().safeParse(id).success && z.uuid().safeParse(domainId).success;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; domainId: string }> },
) {
  const auth = await authorisedPlatformOwner(request);
  if (auth.error || !auth.actor) return auth.error;

  const { id, domainId } = await context.params;
  if (!validIds(id, domainId)) {
    return NextResponse.json({ message: "Invalid domain ID." }, { status: 400 });
  }

  const parsed = platformCustomDomainProvisionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Explicit confirmation is required." },
      { status: 400 },
    );
  }

  try {
    const result = await provisionPlatformCustomDomain({
      organisationId: id,
      domainId,
      actor: auth.actor,
    });
    revalidatePath("/platform");
    revalidatePath(`/platform/dealerships/${id}`);
    return NextResponse.json({
      ok: true,
      ...result,
      message: result.provisioning.ready
        ? "Domain ownership, DNS and TLS configuration are verified. The domain is now live in MotorOS."
        : "The domain is attached to Vercel but verification or DNS configuration is still pending.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The custom domain could not be provisioned.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; domainId: string }> },
) {
  const auth = await authorisedPlatformOwner(request);
  if (auth.error || !auth.actor) return auth.error;

  const { id, domainId } = await context.params;
  if (!validIds(id, domainId)) {
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
    await changePlatformDomainStatusSafely({
      organisationId: id,
      domainId,
      actor: auth.actor,
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
