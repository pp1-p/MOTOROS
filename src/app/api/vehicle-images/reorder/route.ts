import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  vehicleId: z.uuid(),
  imageIds: z.array(z.uuid()).min(1).max(100),
  coverImageId: z.uuid().optional(),
});

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "stock:manage") && !hasPermission(staff.role, "website:manage")) {
    return NextResponse.json({ message: "You do not have image-management access." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid image order." }, { status: 400 });
  }
  const coverId = parsed.data.coverImageId ?? parsed.data.imageIds[0];
  const supabase = createAdminSupabaseClient();
  const rows = await supabase
    .from("vehicle_images")
    .select("id")
    .eq("organisation_id", staff.organisationId)
    .eq("vehicle_id", parsed.data.vehicleId)
    .in("id", parsed.data.imageIds)
    .is("deleted_at", null);
  if ((rows.data?.length ?? 0) !== parsed.data.imageIds.length) {
    return NextResponse.json({ message: "One or more images do not belong to this vehicle." }, { status: 400 });
  }

  const reordered = await supabase.rpc("reorder_vehicle_images", {
    p_organisation_id: staff.organisationId,
    p_vehicle_id: parsed.data.vehicleId,
    p_image_ids: parsed.data.imageIds,
    p_cover_image_id: coverId,
    p_actor_user_id: staff.userId,
  });
  if (reordered.error) {
    return NextResponse.json(
      {
        message:
          "The image order was not changed. Reload the gallery before trying again.",
      },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    message: "Image order saved.",
    result: reordered.data,
  });
}
