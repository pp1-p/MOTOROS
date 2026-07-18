import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const metadataSchema = z.object({
  altText: z.string().trim().min(3).max(240),
  caption: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (
    !hasPermission(staff.role, "stock:manage") &&
    !hasPermission(staff.role, "website:manage")
  ) {
    return NextResponse.json(
      { message: "You do not have image-management access." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid image ID." }, { status: 400 });
  }
  const parsed = metadataSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Add descriptive alt text between 3 and 240 characters." },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const update = await supabase
    .from("vehicle_images")
    .update({
      alt_text: parsed.data.altText,
      caption: parsed.data.caption ?? null,
    })
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .select("id,alt_text,caption")
    .single();
  if (update.error || !update.data) {
    return NextResponse.json(
      { message: "Image details could not be saved." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    message: "Image details saved.",
    image: update.data,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid image ID." }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as { confirm?: boolean } | null;
  if (!body?.confirm) {
    return NextResponse.json({ message: "Deletion confirmation is required." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const deleted = await supabase.rpc("soft_delete_vehicle_image", {
    p_organisation_id: staff.organisationId,
    p_image_id: id,
    p_actor_user_id: staff.userId,
  });
  if (deleted.error || !deleted.data) {
    const notFound = deleted.error?.code === "P0002";
    return NextResponse.json(
      { message: notFound ? "Image not found." : "The image could not be removed." },
      { status: notFound ? 404 : 500 },
    );
  }
  const result = deleted.data as {
    storage_bucket?: string;
    storage_path?: string;
    vehicle_unpublished?: boolean;
  };
  if (result.storage_bucket && result.storage_path) {
    const removed = await supabase.storage
      .from(result.storage_bucket)
      .remove([result.storage_path]);
    if (removed.error) {
      await supabase.from("storage_cleanup_jobs").upsert(
        {
          organisation_id: staff.organisationId,
          bucket_id: result.storage_bucket,
          object_path: result.storage_path,
          reason: "vehicle_image_deleted",
          status: "pending",
          last_error: removed.error.message,
        },
        { onConflict: "bucket_id,object_path" },
      );
      return NextResponse.json(
        {
          ok: true,
          message:
            "Image removed from the vehicle. Storage cleanup has been queued.",
          cleanupQueued: true,
        },
        { status: 202 },
      );
    }
  }
  return NextResponse.json({
    ok: true,
    message: result.vehicle_unpublished
      ? "Image deleted. The vehicle was unpublished because no cover photo remains."
      : "Image deleted.",
    vehicleUnpublished: Boolean(result.vehicle_unpublished),
  });
}
