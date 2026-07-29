import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const staff = await getStaffContext();
  if (!staff) {
    return new Response("Sign in required", { status: 401 });
  }
  if (!hasPermission(staff.role, "invoices:view")) {
    return new Response("Forbidden", { status: 403 });
  }

  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("invoices")
    .select(
      "invoice_number,type,status,customer_name_snapshot,vehicle_registration_snapshot,vehicle_description_snapshot,total,amount_paid,balance,currency,issued_at,due_at,created_at",
    )
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (result.error) {
    return new Response(`Export failed: ${result.error.message}`, {
      status: 500,
    });
  }

  const rows = result.data ?? [];
  const header = [
    "Invoice number",
    "Type",
    "Status",
    "Customer",
    "Registration",
    "Vehicle",
    "Total",
    "Amount paid",
    "Balance",
    "Currency",
    "Issued at",
    "Due at",
    "Created at",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.invoice_number,
        row.type,
        row.status,
        row.customer_name_snapshot,
        row.vehicle_registration_snapshot,
        row.vehicle_description_snapshot,
        row.total,
        row.amount_paid,
        row.balance,
        row.currency,
        row.issued_at,
        row.due_at,
        row.created_at,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const csv = lines.join("\r\n");
  const filename = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
