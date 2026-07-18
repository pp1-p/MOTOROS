import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "documents:view")) {
    return NextResponse.json({ message: "Document access is required." }, { status: 403 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "Invalid document ID." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const document = await supabase
    .from("documents")
    .select("id,storage_bucket,storage_path,file_name,repair_job_id")
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .single();
  if (!document.data) {
    return NextResponse.json(
      { message: "Document not found or your role cannot access it." },
      { status: 404 },
    );
  }

  if (staff.role === "technician") {
    if (!document.data.repair_job_id) {
      return NextResponse.json({ message: "Document not found." }, { status: 404 });
    }
    const job = await supabase
      .from("repair_jobs")
      .select("id")
      .eq("id", document.data.repair_job_id)
      .eq("organisation_id", staff.organisationId)
      .eq("assigned_technician_id", staff.userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (job.error || !job.data) {
      return NextResponse.json({ message: "Document not found." }, { status: 404 });
    }
  }

  const signed = await supabase.storage
    .from(document.data.storage_bucket)
    .createSignedUrl(document.data.storage_path, 60, {
      download: document.data.file_name,
    });
  if (signed.error || !signed.data) {
    return NextResponse.json({ message: "A secure download could not be created." }, { status: 500 });
  }

  return NextResponse.redirect(signed.data.signedUrl, {
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
