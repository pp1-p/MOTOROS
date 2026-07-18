import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { secureCompare } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const secret = getServerEnv().CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!secret) {
    return NextResponse.json(
      { message: "Storage cleanup is not configured." },
      { status: 503 },
    );
  }
  if (!provided || !secureCompare(provided, `Bearer ${secret}`)) {
    return NextResponse.json({ message: "Unauthorised." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const jobs = await supabase.rpc("claim_storage_cleanup_jobs", {
    p_limit: 25,
  });
  if (jobs.error) {
    return NextResponse.json(
      { message: "Cleanup jobs could not be loaded." },
      { status: 500 },
    );
  }

  let completed = 0;
  let failed = 0;
  for (const job of jobs.data ?? []) {
    const removal = await supabase.storage
      .from(job.bucket_id)
      .remove([job.object_path]);
    if (removal.error) {
      failed += 1;
      await supabase
        .from("storage_cleanup_jobs")
        .update({
          status: "failed",
          attempt_count: job.attempt_count + 1,
          last_error: removal.error.message,
        })
        .eq("id", job.id);
    } else {
      completed += 1;
      await supabase
        .from("storage_cleanup_jobs")
        .update({
          status: "completed",
          attempt_count: job.attempt_count + 1,
          last_error: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }

  return NextResponse.json({
    ok: true,
    processed: (jobs.data ?? []).length,
    completed,
    failed,
  });
}
