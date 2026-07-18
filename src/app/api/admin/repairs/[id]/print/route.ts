import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "repairs:view")) {
    return NextResponse.json({ message: "Repair access is required." }, { status: 403 });
  }
  const { id } = await context.params;
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("repair_jobs")
    .select(
      "id,reference,status,registration,vehicle_make_model,mileage,reported_fault,diagnosis,work_completed,technician_notes,start_date,due_date",
    )
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null);
  if (staff.role === "technician") {
    query = query.eq("assigned_technician_id", staff.userId);
  }
  query = z.uuid().safeParse(id).success
    ? query.eq("id", id)
    : query.eq("reference", id.toUpperCase());
  const job = await query.single();
  if (!job.data) {
    return NextResponse.json(
      { message: "Repair job not found or your role cannot access it." },
      { status: 404 },
    );
  }

  const rows = [
    ["Reference", job.data.reference],
    ["Status", String(job.data.status).replaceAll("_", " ")],
    ["Vehicle", job.data.vehicle_make_model],
    ["Registration", job.data.registration],
    ["Mileage", job.data.mileage],
    ["Start date", job.data.start_date],
    ["Due date", job.data.due_date],
    ["Reported fault", job.data.reported_fault],
    ["Diagnosis", job.data.diagnosis],
    ["Work completed", job.data.work_completed],
    ["Technician notes", job.data.technician_notes],
  ];
  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(job.data.reference)} job sheet</title>
<style>
body{font-family:Arial,sans-serif;color:#171814;margin:36px;line-height:1.45}header{display:flex;justify-content:space-between;border-bottom:2px solid #171814;padding-bottom:16px;margin-bottom:24px}h1{margin:0;font-size:26px}small{color:#666}.row{display:grid;grid-template-columns:170px 1fr;border-bottom:1px solid #ddd;padding:11px 0}.row strong{font-size:12px;text-transform:uppercase;letter-spacing:.06em}.row span{white-space:pre-wrap}button{margin:24px 0;padding:10px 16px;border:0;background:#1b5c4f;color:white;border-radius:8px;font-weight:bold}@media print{button{display:none}body{margin:12mm}}
</style></head><body>
<header><div><small>DealerOS repair job</small><h1>${escapeHtml(job.data.reference)}</h1></div><small>Printed ${escapeHtml(new Date().toLocaleString("en-GB"))}</small></header>
${rows.map(([label, value]) => `<div class="row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value) || "—"}</span></div>`).join("")}
<button type="button" onclick="window.print()">Print job sheet</button>
<p><small>Internal commercial notes and customer contact details are intentionally omitted.</small></p>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
