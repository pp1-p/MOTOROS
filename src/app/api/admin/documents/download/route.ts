import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "documents:view")) {
    return NextResponse.json({ message: "Document access is required." }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const job = params.get("job")?.slice(0, 120);
  const name = params.get("name")?.slice(0, 200);
  if (!job || !name) {
    return NextResponse.json({ message: "Document reference is incomplete." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  let jobQuery = supabase
    .from("repair_jobs")
    .select("id")
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null);
  jobQuery = z.uuid().safeParse(job).success
    ? jobQuery.eq("id", job)
    : jobQuery.eq("reference", job.toUpperCase());
  if (staff.role === "technician") {
    jobQuery = jobQuery.eq("assigned_technician_id", staff.userId);
  }
  const repairJob = await jobQuery.single();
  if (!repairJob.data) {
    return NextResponse.json({ message: "Repair job not found." }, { status: 404 });
  }

  const document = await supabase
    .from("documents")
    .select("storage_bucket,storage_path,file_name")
    .eq("organisation_id", staff.organisationId)
    .eq("repair_job_id", repairJob.data.id)
    .eq("file_name", name)
    .is("deleted_at", null)
    .limit(1)
    .single();
  if (!document.data) {
    return NextResponse.json(
      { message: "Document not found or your role cannot access it." },
      { status: 404 },
    );
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
