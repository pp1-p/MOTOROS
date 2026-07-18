import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  confirm: z.literal(true),
  reason: z.string().trim().min(10).max(1000),
  requestReference: z.string().trim().min(3).max(120),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!["owner", "manager"].includes(staff.role)) {
    return NextResponse.json({ message: "An owner or manager must approve anonymisation." }, { status: 403 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid customer ID." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Confirmation, request reference and a clear reason are required.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("customers")
    .select("id,marketing_consent")
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .single();
  if (!existing.data) return NextResponse.json({ message: "Customer not found." }, { status: 404 });

  const suffix = id.replaceAll("-", "").slice(0, 12);
  const result = await supabase
    .from("customers")
    .update({
      full_name: `Anonymised customer ${suffix.slice(0, 6)}`,
      email: `anonymised+${suffix}@invalid.local`,
      phone: null,
      address: {},
      preferred_contact_method: "email",
      marketing_consent: false,
      do_not_contact: true,
      anonymised_at: new Date().toISOString(),
      notes: `Anonymised under request ${parsed.data.requestReference}.`,
    })
    .eq("id", id)
    .eq("organisation_id", staff.organisationId);
  if (result.error) {
    return NextResponse.json(
      { message: "The customer was not anonymised. No partial change was confirmed." },
      { status: 500 },
    );
  }
  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: "customer.anonymised",
    entity_type: "customer",
    entity_id: id,
    change_reason: `${parsed.data.requestReference}: ${parsed.data.reason}`,
    old_values: {
      anonymised_fields: ["full_name", "email", "phone", "address", "notes"],
      marketing_consent: existing.data.marketing_consent,
    },
    new_values: { anonymised: true },
  });
  return NextResponse.json({
    ok: true,
    message:
      "Direct contact details have been anonymised. Statutory transaction records remain subject to the dealership's reviewed retention policy.",
  });
}
