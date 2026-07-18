import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "stock:view")) {
    return NextResponse.json({ message: "Stock access is required." }, { status: 403 });
  }
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "stock_number,registration,make,model,derivative,year,mileage,fuel_type,transmission,colour,status,retail_price,is_public,created_at",
    )
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ message: "Stock export failed." }, { status: 500 });

  const headers = [
    "stock_number",
    "registration",
    "make",
    "model",
    "derivative",
    "year",
    "mileage",
    "fuel_type",
    "transmission",
    "colour",
    "status",
    "retail_price",
    "is_public",
    "created_at",
  ] as const;
  const csv = [
    headers.map(csvCell).join(","),
    ...(data ?? []).map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dealeros-stock-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
