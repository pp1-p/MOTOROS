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
  if (!hasPermission(staff.role, "audit:view")) {
    return NextResponse.json(
      { message: "Audit export access is required." },
      { status: 403 },
    );
  }
  const result = await createAdminSupabaseClient()
    .from("audit_logs")
    .select(
      "occurred_at,actor_user_id,action,entity_type,entity_id,change_reason,source",
    )
    .eq("organisation_id", staff.organisationId)
    .order("occurred_at", { ascending: false })
    .limit(10_000);
  if (result.error) {
    return NextResponse.json(
      { message: "The audit export could not be generated." },
      { status: 500 },
    );
  }
  const rows = [
    [
      "Timestamp",
      "Actor user ID",
      "Action",
      "Entity type",
      "Entity ID",
      "Reason",
      "Source",
    ],
    ...(result.data ?? []).map((event) => [
      event.occurred_at,
      event.actor_user_id,
      event.action,
      event.entity_type,
      event.entity_id,
      event.change_reason,
      event.source,
    ]),
  ];
  return new NextResponse(
    rows.map((row) => row.map(cell).join(",")).join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dealeros-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
