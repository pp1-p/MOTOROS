import "server-only";

import { addMinutes, isAfter, isBefore, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getDefaultOrganisationId } from "@/lib/data/organisation";

export type AvailableSlot = {
  start: string;
  end: string;
  label: string;
};

type Rule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  minimum_notice_hours: number;
  maximum_advance_days: number;
  maximum_simultaneous: number;
  timezone: string;
};

const defaultRule: Rule = {
  day_of_week: 1,
  start_time: "09:00:00",
  end_time: "17:00:00",
  slot_duration_minutes: 30,
  buffer_minutes: 10,
  minimum_notice_hours: 24,
  maximum_advance_days: 45,
  maximum_simultaneous: 1,
  timezone: "Europe/London",
};

export async function getAvailableRepairCallSlots(date: string) {
  const dateStart = parseISO(`${date}T00:00:00Z`);
  if (Number.isNaN(dateStart.getTime())) return [];
  const dayOfWeek = dateStart.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return [];

  let rule: Rule = { ...defaultRule, day_of_week: dayOfWeek };
  let existing: Array<{ starts_at: string; ends_at: string }> = [];
  let isClosed = false;

  if (isSupabaseConfigured()) {
    const organisationId = await getDefaultOrganisationId();
    const supabase = createAdminSupabaseClient();

    const [ruleResult, exceptionResult] = await Promise.all([
      supabase
        .from("availability_rules")
        .select(
          "day_of_week,start_time,end_time,slot_duration_minutes,buffer_minutes,minimum_notice_hours,maximum_advance_days,maximum_simultaneous,timezone",
        )
        .eq("organisation_id", organisationId)
        .eq("appointment_type", "repair_call")
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("availability_exceptions")
        .select("is_closed")
        .eq("organisation_id", organisationId)
        .eq("exception_date", date)
        .limit(1)
        .maybeSingle(),
    ]);

    if (ruleResult.data) rule = ruleResult.data as Rule;
    else return [];
    isClosed = Boolean(exceptionResult.data?.is_closed);

    const dayStart = fromZonedTime(`${date}T00:00:00`, rule.timezone);
    const dayEnd = addMinutes(dayStart, 24 * 60);
    const bookings = await supabase
      .from("appointments")
      .select("starts_at,ends_at")
      .eq("organisation_id", organisationId)
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString())
      .not("status", "in", '("cancelled","no_show")');
    existing = (bookings.data ?? []) as typeof existing;
  }

  if (isClosed) return [];

  const now = new Date();
  const firstAllowed = addMinutes(now, rule.minimum_notice_hours * 60);
  const lastAllowed = addMinutes(now, rule.maximum_advance_days * 24 * 60);
  let cursor = fromZonedTime(`${date}T${rule.start_time}`, rule.timezone);
  const finish = fromZonedTime(`${date}T${rule.end_time}`, rule.timezone);
  const slots: AvailableSlot[] = [];

  while (!isAfter(addMinutes(cursor, rule.slot_duration_minutes), finish)) {
    const end = addMinutes(cursor, rule.slot_duration_minutes);
    const overlapCount = existing.filter(
      (appointment) =>
        isBefore(parseISO(appointment.starts_at), end) &&
        isAfter(parseISO(appointment.ends_at), cursor),
    ).length;

    if (
      isAfter(cursor, firstAllowed) &&
      isBefore(cursor, lastAllowed) &&
      overlapCount < rule.maximum_simultaneous
    ) {
      slots.push({
        start: cursor.toISOString(),
        end: end.toISOString(),
        label: formatInTimeZone(cursor, rule.timezone, "HH:mm"),
      });
    }

    cursor = addMinutes(
      cursor,
      rule.slot_duration_minutes + rule.buffer_minutes,
    );
  }

  return slots;
}
