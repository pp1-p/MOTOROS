import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  }

  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in required" }, { status: 401 });
  }
  if (!hasPermission(staff.role, "invoices:manage")) {
    return NextResponse.json(
      { message: "Invoice duplication is not permitted for your role." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  const result = await supabase.rpc("duplicate_invoice", {
    p_actor_user_id: staff.userId,
    p_source_invoice_id: id,
  });
  if (result.error) {
    return NextResponse.json(
      { message: result.error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ id: result.data as string }, { status: 201 });
}
