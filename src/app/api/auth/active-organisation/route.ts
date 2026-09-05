import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/security/request";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ACTIVE_ORGANISATION_COOKIE,
  ACTIVE_ORGANISATION_COOKIE_OPTIONS,
  chooseActiveMembership,
  membershipOrganisation,
  type MembershipCandidate,
} from "@/lib/tenancy/membership";

const switchSchema = z.object({ organisationId: z.uuid() });

async function authenticatedMemberships() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, memberships: [] as MembershipCandidate[] };

  const result = await supabase
    .from("organisation_members")
    .select(
      "organisation_id,role,is_primary,created_at,organisations(id,name,status,deleted_at)",
    )
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (result.error) throw result.error;
  return {
    user,
    memberships: (result.data ?? []) as MembershipCandidate[],
  };
}

export async function GET(request: Request) {
  try {
    const { user, memberships } = await authenticatedMemberships();
    if (!user) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const cookieHeader = request.headers.get("cookie") ?? "";
    const selectedValue = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ACTIVE_ORGANISATION_COOKIE}=`))
      ?.slice(ACTIVE_ORGANISATION_COOKIE.length + 1);
    const selected = chooseActiveMembership(memberships, selectedValue);
    const eligible = memberships
      .filter((membership) => chooseActiveMembership([membership]) !== null)
      .map((membership) => ({
        id: membership.organisation_id,
        name: membershipOrganisation(membership)?.name ?? "Dealership",
        role: membership.role,
        isPrimary: Boolean(membership.is_primary),
      }));

    return NextResponse.json({
      activeOrganisationId: selected?.organisation_id ?? null,
      organisations: eligible,
    });
  } catch {
    return NextResponse.json(
      { message: "Dealership access could not be loaded." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const parsed = switchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Choose a valid dealership." }, { status: 400 });
  }

  try {
    const { user, memberships } = await authenticatedMemberships();
    if (!user) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const selected = chooseActiveMembership(
      memberships,
      parsed.data.organisationId,
    );
    if (!selected || selected.organisation_id !== parsed.data.organisationId) {
      return NextResponse.json(
        { message: "You do not have active access to that dealership." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      organisationId: selected.organisation_id,
    });
    response.cookies.set(
      ACTIVE_ORGANISATION_COOKIE,
      selected.organisation_id,
      {
        ...ACTIVE_ORGANISATION_COOKIE_OPTIONS,
        secure: process.env.NODE_ENV === "production",
      },
    );
    return response;
  } catch {
    return NextResponse.json(
      { message: "The active dealership could not be changed." },
      { status: 503 },
    );
  }
}
