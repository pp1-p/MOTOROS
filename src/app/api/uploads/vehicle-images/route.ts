import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const allowedTypes = new Map([
  ["image/jpeg", { extension: "jpg", signatures: [[0xff, 0xd8, 0xff]] }],
  ["image/png", { extension: "png", signatures: [[0x89, 0x50, 0x4e, 0x47]] }],
  [
    "image/webp",
    {
      extension: "webp",
      signatures: [[0x52, 0x49, 0x46, 0x46]],
    },
  ],
]);
const maxBytes = 12 * 1024 * 1024;

function hasSignature(bytes: Uint8Array, signatures: number[][], mimeType: string) {
  const prefixMatches = signatures.some((signature) =>
    signature.every((byte, index) => bytes[index] === byte),
  );
  if (!prefixMatches) return false;
  if (mimeType === "image/webp") {
    return String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return true;
}

export async function POST(request: Request) {
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

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const vehicleId = form?.get("vehicleId");
  const altText = form?.get("altText");
  const caption = form?.get("caption");

  if (!(file instanceof File) || typeof vehicleId !== "string" || !z.uuid().safeParse(vehicleId).success) {
    return NextResponse.json({ message: "Choose a valid image and vehicle." }, { status: 400 });
  }
  const type = allowedTypes.get(file.type);
  if (!type || file.size < 1 || file.size > maxBytes) {
    return NextResponse.json(
      { message: "Images must be JPG, PNG or WebP and no larger than 12 MB." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasSignature(bytes, type.signatures, file.type)) {
    return NextResponse.json(
      { message: "The file contents do not match the selected image type." },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const vehicle = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .single();
  if (!vehicle.data) return NextResponse.json({ message: "Vehicle not found." }, { status: 404 });

  const storagePath = `${staff.organisationId}/${vehicleId}/${crypto.randomUUID()}.${type.extension}`;
  const upload = await supabase.storage
    .from("vehicle-public")
    .upload(storagePath, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
  if (upload.error) {
    return NextResponse.json({ message: "The image upload failed. Please retry." }, { status: 500 });
  }

  const record = await supabase.rpc("attach_vehicle_image", {
    p_organisation_id: staff.organisationId,
    p_vehicle_id: vehicleId,
    p_storage_bucket: "vehicle-public",
    p_storage_path: storagePath,
    p_mime_type: file.type,
    p_byte_size: file.size,
    p_alt_text:
      typeof altText === "string" && altText.trim()
        ? altText.trim().slice(0, 240)
        : "Vehicle photograph",
    p_caption:
      typeof caption === "string" && caption.trim()
        ? caption.trim().slice(0, 500)
        : null,
    p_actor_user_id: staff.userId,
  });

  if (record.error || !record.data) {
    await supabase.storage.from("vehicle-public").remove([storagePath]);
    return NextResponse.json(
      { message: "The image was not attached to the vehicle and has been removed." },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("vehicle-public").getPublicUrl(storagePath);

  return NextResponse.json(
    {
      ok: true,
      message: "Image uploaded.",
      image: {
        ...(record.data as Record<string, unknown>),
        publicUrl,
      },
    },
    { status: 201 },
  );
}
