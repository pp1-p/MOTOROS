import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const booleanValue = z.preprocess(
  (value) => value === true || value === "true" || value === "on",
  z.boolean(),
);
const nullable = (schema: z.ZodType) =>
  z.preprocess((value) => (value === "" ? null : value), schema.nullable());
const schema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  email: nullable(z.email().max(254)).optional(),
  phone: nullable(z.string().trim().max(30)).optional(),
  preferredContact: z.enum(["email", "phone", "sms", "either"]).optional(),
  address: nullable(z.string().trim().max(1000)).optional(),
  notes: nullable(z.string().trim().max(5000)).optional(),
  marketingConsent: booleanValue.optional(),
  doNotContact: booleanValue.optional(),
});

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? { firstName: parts[0]!, lastName: "Customer" }
    : { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1)! };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "customers:view")) {
    return NextResponse.json({ message: "Customer access is required." }, { status: 403 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid customer ID." }, { status: 400 });
  }
  const customer = await (await createServerSupabaseClient())
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .single();
  if (customer.error || !customer.data) {
    return NextResponse.json({ message: "Customer not found." }, { status: 404 });
  }
  return NextResponse.json({ customer: customer.data });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "customers:manage")) {
    return NextResponse.json(
      { message: "Customer-management access is required." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid customer ID." }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Review the customer details." }, { status: 400 });
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) {
    const name = splitName(parsed.data.name);
    updates.full_name = parsed.data.name;
    updates.first_name = name.firstName;
    updates.last_name = name.lastName;
  }
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.preferredContact !== undefined) {
    updates.preferred_contact_method = parsed.data.preferredContact;
  }
  if (parsed.data.address !== undefined) {
    updates.address = parsed.data.address ? { formatted: parsed.data.address } : {};
  }
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.doNotContact !== undefined) {
    updates.do_not_contact = parsed.data.doNotContact;
  }
  if (parsed.data.marketingConsent !== undefined) {
    updates.marketing_consent = parsed.data.marketingConsent;
    updates.marketing_consent_at = parsed.data.marketingConsent
      ? new Date().toISOString()
      : null;
    updates.marketing_consent_source = parsed.data.marketingConsent
      ? "staff_recorded"
      : null;
  }
  const session = await createServerSupabaseClient();
  const existing = await session
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .single();
  if (existing.error || !existing.data) {
    return NextResponse.json({ message: "Customer not found." }, { status: 404 });
  }
  const admin = createAdminSupabaseClient();
  const customer = await admin
    .from("customers")
    .update(updates)
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .select("*")
    .single();
  if (customer.error || !customer.data) {
    const duplicate = customer.error?.code === "23505";
    return NextResponse.json(
      {
        message: duplicate
          ? "That email or telephone belongs to another customer."
          : "The customer could not be updated.",
      },
      { status: duplicate ? 409 : 500 },
    );
  }
  await admin.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    action: "customer.updated",
    entity_type: "customer",
    entity_id: id,
    old_values: existing.data,
    new_values: customer.data,
  });
  return NextResponse.json({
    ok: true,
    message: "Customer updated.",
    customer: customer.data,
  });
}
