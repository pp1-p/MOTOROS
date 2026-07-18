import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function cell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "customers:view")) {
    return NextResponse.json(
      { message: "Customer access is required." },
      { status: 403 },
    );
  }
  const result = await createAdminSupabaseClient()
    .from("customers")
    .select(
      "id,full_name,email,phone,preferred_contact_method,marketing_consent,marketing_consent_at,do_not_contact,created_at,updated_at",
    )
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20_000);
  if (result.error) {
    return NextResponse.json(
      { message: "The customer export could not be generated." },
      { status: 500 },
    );
  }
  const rows = [
    [
      "Customer ID",
      "Name",
      "Email",
      "Telephone",
      "Preferred contact",
      "Marketing consent",
      "Consent timestamp",
      "Do not contact",
      "Created",
      "Updated",
    ],
    ...(result.data ?? []).map((customer) => [
      customer.id,
      customer.full_name,
      customer.email,
      customer.phone,
      customer.preferred_contact_method,
      customer.marketing_consent,
      customer.marketing_consent_at,
      customer.do_not_contact,
      customer.created_at,
      customer.updated_at,
    ]),
  ];
  return new NextResponse(
    rows.map((row) => row.map(cell).join(",")).join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dealeros-customers-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
