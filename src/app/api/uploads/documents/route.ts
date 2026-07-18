import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const fileTypes = new Map([
  ["application/pdf", { extension: "pdf", signature: [0x25, 0x50, 0x44, 0x46] }],
  ["image/jpeg", { extension: "jpg", signature: [0xff, 0xd8, 0xff] }],
  ["image/png", { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47] }],
  ["image/webp", { extension: "webp", signature: [0x52, 0x49, 0x46, 0x46] }],
]);
const entityConfig = {
  vehicle: { table: "vehicles", column: "vehicle_id" },
  customer: { table: "customers", column: "customer_id" },
  lead: { table: "leads", column: "lead_id" },
  sourcing_request: {
    table: "sourcing_requests",
    column: "sourcing_request_id",
  },
  appointment: { table: "appointments", column: "appointment_id" },
  repair_job: { table: "repair_jobs", column: "repair_job_id" },
  sale: { table: "sales", column: "sale_id" },
} as const;

function signatureMatches(bytes: Uint8Array, mimeType: string, signature: number[]) {
  const prefix = signature.every((byte, index) => bytes[index] === byte);
  if (!prefix) return false;
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
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "documents:manage")) {
    return NextResponse.json(
      { message: "Document-upload access is required." },
      { status: 403 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const title = String(form?.get("title") ?? "").trim();
  const documentType = String(form?.get("documentType") ?? "other")
    .trim()
    .slice(0, 80);
  const rawEntityType = String(form?.get("entityType") ?? "").trim();
  const entityId = String(form?.get("entityId") ?? "").trim();
  const type = file instanceof File ? fileTypes.get(file.type) : null;
  if (
    !(file instanceof File) ||
    !type ||
    file.size < 1 ||
    file.size > 20 * 1024 * 1024 ||
    title.length < 2 ||
    title.length > 200
  ) {
    return NextResponse.json(
      {
        message:
          "Choose a PDF, JPG, PNG or WebP under 20 MB and add a document title.",
      },
      { status: 400 },
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signatureMatches(bytes, file.type, type.signature)) {
    return NextResponse.json(
      { message: "The file contents do not match its declared type." },
      { status: 400 },
    );
  }

  const entityType =
    rawEntityType in entityConfig
      ? (rawEntityType as keyof typeof entityConfig)
      : null;
  if ((entityType && !z.uuid().safeParse(entityId).success) || (!entityType && entityId)) {
    return NextResponse.json(
      { message: "Choose a valid linked record or leave both link fields empty." },
      { status: 400 },
    );
  }
  if (staff.role === "technician" && entityType !== "repair_job") {
    return NextResponse.json(
      { message: "Technicians can upload documents only to an assigned repair job." },
      { status: 403 },
    );
  }

  const supabase = createAdminSupabaseClient();
  if (entityType === "repair_job" && staff.role === "technician") {
    const target = await supabase
      .from("repair_jobs")
      .select("id")
      .eq("id", entityId)
      .eq("organisation_id", staff.organisationId)
      .eq("assigned_technician_id", staff.userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (target.error || !target.data) {
      return NextResponse.json(
        { message: "That repair job is not assigned to you." },
        { status: 403 },
      );
    }
  } else if (entityType) {
    const target = await supabase
      .from(entityConfig[entityType].table)
      .select("id")
      .eq("id", entityId)
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (target.error || !target.data) {
      return NextResponse.json(
        { message: "The linked record was not found in this dealership." },
        { status: 404 },
      );
    }
  }

  const path = `${staff.organisationId}/documents/${crypto.randomUUID()}.${type.extension}`;
  const upload = await supabase.storage
    .from("private-documents")
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (upload.error) {
    return NextResponse.json({ message: "The document upload failed." }, { status: 500 });
  }

  const linkedColumn = entityType ? entityConfig[entityType].column : null;
  const document = await supabase
    .from("documents")
    .insert({
      organisation_id: staff.organisationId,
      title,
      file_name: file.name.slice(0, 200),
      document_type: documentType || "other",
      storage_bucket: "private-documents",
      storage_path: path,
      mime_type: file.type,
      byte_size: file.size,
      size_bytes: file.size,
      visibility: "private",
      entity_type: entityType,
      entity_id: entityType ? entityId : null,
      ...(linkedColumn ? { [linkedColumn]: entityId } : {}),
      created_by: staff.userId,
    })
    .select("id,title,file_name")
    .single();
  if (document.error || !document.data) {
    await supabase.storage.from("private-documents").remove([path]);
    return NextResponse.json(
      { message: "The document could not be recorded and the upload was removed." },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { ok: true, message: "Document uploaded securely.", document: document.data },
    { status: 201 },
  );
}
