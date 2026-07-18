import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z
  .object({
    sourceCustomerId: z.uuid(),
    targetCustomerId: z.uuid(),
    confirm: z.literal(true),
  })
  .refine((value) => value.sourceCustomerId !== value.targetCustomerId, {
    message: "Source and target customers must be different.",
  });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!["owner", "manager"].includes(staff.role)) {
    return NextResponse.json({ message: "An owner or manager must merge customer records." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Review and confirm the merge." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("merge_customers", {
    p_organisation_id: staff.organisationId,
    p_source_customer_id: parsed.data.sourceCustomerId,
    p_target_customer_id: parsed.data.targetCustomerId,
    p_actor_user_id: staff.userId,
  });
  if (error) {
    return NextResponse.json(
      { message: "The customer records were not merged. No partial merge was accepted." },
      { status: 409 },
    );
  }
  return NextResponse.json({
    ok: true,
    message: "Customer records merged with an audit record.",
    result: data,
  });
}
