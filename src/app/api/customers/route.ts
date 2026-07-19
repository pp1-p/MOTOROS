import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { splitCustomerName } from "@/lib/utils";

const optionalEmail = z.preprocess(
  (value) => (value === "" ? null : value),
  z.email().max(254).nullable(),
);
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().trim().max(max).nullable(),
  );
const booleanValue = z.preprocess(
  (value) => value === true || value === "true" || value === "on",
  z.boolean(),
);
const schema = z
  .object({
    name: z.string().trim().min(2).max(160),
    email: optionalEmail,
    phone: optionalText(30),
    preferredContact: z.enum(["email", "phone", "sms", "either"]).default("either"),
    address: optionalText(1000),
    notes: optionalText(5000),
    marketingConsent: booleanValue.default(false),
    doNotContact: booleanValue.default(false),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Add an email address or telephone number.",
    path: ["email"],
  });


export async function POST(request: Request) {
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
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message:
          parsed.error.issues[0]?.message ?? "Review the customer details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  const name = splitCustomerName(parsed.data.name);
  const customer = await createAdminSupabaseClient()
    .from("customers")
    .insert({
      organisation_id: staff.organisationId,
      first_name: name.firstName,
      last_name: name.lastName,
      full_name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      preferred_contact_method: parsed.data.preferredContact,
      address: parsed.data.address ? { formatted: parsed.data.address } : {},
      notes: parsed.data.notes,
      marketing_consent: parsed.data.marketingConsent,
      marketing_consent_at: parsed.data.marketingConsent
        ? new Date().toISOString()
        : null,
      marketing_consent_source: parsed.data.marketingConsent
        ? "staff_recorded"
        : null,
      do_not_contact: parsed.data.doNotContact,
      created_by: staff.userId,
    })
    .select("id,full_name,email,phone")
    .single();
  if (customer.error) {
    const duplicate = customer.error.code === "23505";
    return NextResponse.json(
      {
        message: duplicate
          ? "A customer with that email or telephone already exists."
          : "The customer could not be created.",
      },
      { status: duplicate ? 409 : 500 },
    );
  }
  return NextResponse.json(
    { ok: true, message: "Customer created.", customer: customer.data },
    { status: 201 },
  );
}
