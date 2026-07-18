import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const types = new Map([
  ["image/jpeg", { extension: "jpg", signature: [0xff, 0xd8, 0xff] }],
  ["image/png", { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47] }],
  ["image/webp", { extension: "webp", signature: [0x52, 0x49, 0x46, 0x46] }],
]);

function validSignature(bytes: Uint8Array, mimeType: string, signature: number[]) {
  const prefix = signature.every((byte, index) => bytes[index] === byte);
  return mimeType === "image/webp"
    ? prefix && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    : prefix;
}

export async function POST(request: Request) {
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
    !hasPermission(staff.role, "settings:manage") &&
    !hasPermission(staff.role, "website:manage")
  ) {
    return NextResponse.json(
      { message: "Brand-management access is required." },
      { status: 403 },
    );
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const type = file instanceof File ? types.get(file.type) : null;
  if (!(file instanceof File) || !type || file.size < 1 || file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { message: "Choose a JPG, PNG or WebP logo no larger than 5 MB." },
      { status: 400 },
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(bytes, file.type, type.signature)) {
    return NextResponse.json(
      { message: "The logo contents do not match its image type." },
      { status: 400 },
    );
  }
  const supabase = createAdminSupabaseClient();
  const current = await supabase
    .from("dealership_settings")
    .select("logo_path")
    .eq("organisation_id", staff.organisationId)
    .single();
  if (current.error || !current.data) {
    return NextResponse.json({ message: "Dealership settings were not found." }, { status: 404 });
  }
  const path = `${staff.organisationId}/branding/logo-${crypto.randomUUID()}.${type.extension}`;
  const upload = await supabase.storage
    .from("branding-public")
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
  if (upload.error) {
    return NextResponse.json({ message: "The logo upload failed." }, { status: 500 });
  }
  const update = await supabase
    .from("dealership_settings")
    .update({ logo_path: path })
    .eq("organisation_id", staff.organisationId);
  if (update.error) {
    await supabase.storage.from("branding-public").remove([path]);
    return NextResponse.json(
      { message: "The logo was not saved and the upload was removed." },
      { status: 500 },
    );
  }
  if (current.data.logo_path) {
    await supabase.storage
      .from("branding-public")
      .remove([current.data.logo_path]);
  }
  const publicUrl = supabase.storage
    .from("branding-public")
    .getPublicUrl(path).data.publicUrl;
  revalidatePath("/", "layout");
  return NextResponse.json(
    { ok: true, message: "Brand logo updated.", publicUrl },
    { status: 201 },
  );
}
