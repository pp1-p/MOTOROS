import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getRepairCodes } from "@/lib/data/admin-repair-codes";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { repairCodeCategories } from "@/lib/validation/repair-codes";
import { repairCodeCreateSchema } from "@/lib/validation/repair-codes";

export async function GET(request: Request) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in required" }, { status: 401 });
  }
  if (!hasPermission(staff.role, "settings:manage") &&
      !hasPermission(staff.role, "repairs:view")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const rawCategory = url.searchParams.get("category") ?? undefined;
  const category =
    rawCategory && (rawCategory === "all" ||
      repairCodeCategories.includes(rawCategory as typeof repairCodeCategories[number]))
      ? (rawCategory as typeof repairCodeCategories[number] | "all")
      : undefined;

  try {
    const codes = await getRepairCodes({
      search: url.searchParams.get("q") ?? undefined,
      category,
      includeInactive: url.searchParams.get("includeInactive") === "1",
    });
    return NextResponse.json({ codes });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Load failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in required" }, { status: 401 });
  }
  if (!hasPermission(staff.role, "settings:manage") &&
      !hasPermission(staff.role, "repairs:manage")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const parsed = repairCodeCreateSchema.safeParse(
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
  const insert = await supabase
    .from("repair_codes")
    .insert({
      organisation_id: staff.organisationId,
      code: parsed.data.code,
      description: parsed.data.description,
      default_price: parsed.data.default_price,
      labour_hours: parsed.data.labour_hours,
      tax_rate: parsed.data.tax_rate,
      category: parsed.data.category,
      active: parsed.data.active,
      created_by: staff.userId,
    })
    .select("id")
    .single();

  if (insert.error) {
    const isDuplicate = insert.error.code === "23505";
    return NextResponse.json(
      {
        message: isDuplicate
          ? `Code "${parsed.data.code}" already exists`
          : insert.error.message,
      },
      { status: isDuplicate ? 409 : 500 },
    );
  }
  return NextResponse.json({ id: insert.data.id }, { status: 201 });
}
