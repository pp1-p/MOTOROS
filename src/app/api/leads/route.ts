import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { enquirySchema } from "@/lib/validation/public";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  }
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json(
      { message: "Sign in is required." },
      { status: 401 },
    );
  }
  if (!hasPermission(staff.role, "leads:manage")) {
    return NextResponse.json(
      { message: "Lead-management access is required." },
      { status: 403 },
    );
  }
  const parsed = enquirySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Review the lead details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const result = await supabase.rpc("submit_public_enquiry", {
    p_organisation_id: staff.organisationId,
    p_payload: {
      ...parsed.data,
      source: parsed.data.source || "staff_created",
    },
  });
  const leadId = (result.data as { lead_id?: string } | null)?.lead_id;
  if (result.error || !leadId) {
    return NextResponse.json(
      {
        message:
          "The lead could not be created. No partial customer or enquiry record was accepted.",
      },
      { status: 500 },
    );
  }

  await supabase
    .from("leads")
    .update({ created_by: staff.userId })
    .eq("id", leadId)
    .eq("organisation_id", staff.organisationId);

  return NextResponse.json(
    {
      ok: true,
      message: "Lead created and added to the New queue.",
      leadId,
    },
    { status: 201 },
  );
}
