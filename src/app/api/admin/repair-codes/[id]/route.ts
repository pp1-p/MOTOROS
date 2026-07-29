import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { repairCodeUpdateSchema } from "@/lib/validation/repair-codes";

async function requireManagePermission() {
  const staff = await getStaffContext();
  if (!staff) {
    return {
      staff: null,
      response: NextResponse.json({ message: "Sign in required" }, { status: 401 }),
    };
  }
  if (
    !hasPermission(staff.role, "settings:manage") &&
    !hasPermission(staff.role, "repairs:manage")
  ) {
    return {
      staff: null,
      response: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    };
  }
  return { staff, response: null };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  }
  const { staff, response } = await requireManagePermission();
  if (!staff) return response!;

  const { id } = await params;
  const parsed = repairCodeUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Please check the highlighted fields",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const update = await supabase
    .from("repair_codes")
    .update(parsed.data)
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (update.error) {
    const isDuplicate = update.error.code === "23505";
    return NextResponse.json(
      {
        message: isDuplicate
          ? "Another code with that value already exists"
          : update.error.message,
      },
      { status: isDuplicate ? 409 : 500 },
    );
  }
  if (!update.data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ id: update.data.id });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  }
  const { staff, response } = await requireManagePermission();
  if (!staff) return response!;

  const { id } = await params;
  const supabase = createAdminSupabaseClient();
  const del = await supabase
    .from("repair_codes")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (del.error) {
    return NextResponse.json({ message: del.error.message }, { status: 500 });
  }
  if (!del.data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
