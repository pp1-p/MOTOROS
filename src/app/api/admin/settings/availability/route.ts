import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.object({
  availableDays: z.string().default(""),
  "Monday-start": z.string().regex(/^\d{2}:\d{2}$/).optional(),
  "Monday-end": z.string().regex(/^\d{2}:\d{2}$/).optional(),
  "Tuesday-start": z.string().regex(/^\d{2}:\d{2}$/).optional(),
  "Tuesday-end": z.string().regex(/^\d{2}:\d{2}$/).optional(),
  "Wednesday-start": z.string().regex(/^\d{2}:\d{2}$/).optional(),
  "Wednesday-end": z.string().regex(/^\d{2}:\d{2}$/).optional(),
  "Thursday-start": z.string().regex(/^\d{2}:\d{2}$/).optional(),
  "Thursday-end": z.string().regex(/^\d{2}:\d{2}$/).optional(),
  "Friday-start": z.string().regex(/^\d{2}:\d{2}$/).optional(),
  "Friday-end": z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotDuration: z.coerce.number().int().min(10).max(240),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  minimumNoticeHours: z.coerce.number().int().min(0).max(720),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
});

const dayDetails = [
  ["monday", "Monday", 1],
  ["tuesday", "Tuesday", 2],
  ["wednesday", "Wednesday", 3],
  ["thursday", "Thursday", 4],
  ["friday", "Friday", 5],
] as const;

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "settings:manage") && !hasPermission(staff.role, "diary:manage")) {
    return NextResponse.json({ message: "Diary-settings access is required." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the availability rules.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const enabled = new Set(parsed.data.availableDays.split(",").filter(Boolean));
  const rows = dayDetails.map(([name, label, dayOfWeek]) => {
    const start = parsed.data[`${label}-start`];
    const end = parsed.data[`${label}-end`];
    if (start && end && start >= end) {
      throw new Error(`${label} finishing time must be after its starting time.`);
    }
    return {
      organisation_id: staff.organisationId,
      weekday: dayOfWeek,
      start_time_local: `${start ?? "09:00"}:00`,
      end_time_local: `${end ?? "17:00"}:00`,
      slot_duration_minutes: parsed.data.slotDuration,
      buffer_minutes: parsed.data.bufferMinutes,
      minimum_notice_minutes: parsed.data.minimumNoticeHours * 60,
      maximum_advance_days: parsed.data.maxAdvanceDays,
      maximum_simultaneous: 1,
      timezone: "Europe/London",
      appointment_type: "repair_call",
      active: enabled.has(name),
      created_by: staff.userId,
    };
  });

  try {
    const supabase = createAdminSupabaseClient();
    const appointmentType = await supabase
      .from("appointment_types")
      .select("id")
      .eq("organisation_id", staff.organisationId)
      .eq("slug", "repair-call")
      .single();
    if (!appointmentType.data) {
      throw new Error("The repair-call appointment type is not configured.");
    }
    const result = await supabase.rpc("replace_availability_rules", {
      p_organisation_id: staff.organisationId,
      p_appointment_type_id: appointmentType.data.id,
      p_rules: rows,
      p_actor_user_id: staff.userId,
    });
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ ok: true, message: "Diary availability saved." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Availability could not be saved." },
      { status: 400 },
    );
  }
}
