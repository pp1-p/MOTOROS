"use client";

import { addDays, format, parseISO } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Phone,
  Plus,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  AdminDiaryAppointment,
  AdminDiaryStaffOption,
} from "@/lib/types/admin-operational";
import { cn } from "@/lib/utils";

const hourRows = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

export function DiaryWorkspace({
  appointments,
  weekStart,
  timezone,
  staffOptions,
}: {
  appointments: AdminDiaryAppointment[];
  weekStart: string;
  timezone: string;
  staffOptions: AdminDiaryStaffOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekStartDate = parseISO(weekStart);
  const days = useMemo(
    () => {
      const start = parseISO(weekStart);
      return (
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(start, index);
        return {
          day: format(date, "EEE"),
          date: format(date, "d"),
          iso: format(date, "yyyy-MM-dd"),
          label: format(date, "EEEE, d MMMM"),
        };
      })
      );
    },
    [weekStart],
  );
  const today = format(new Date(), "yyyy-MM-dd");
  const selectedDay = days.find((day) => day.iso === today) ?? days[0]!;
  const weekEndDate = addDays(weekStartDate, 6);
  const [view, setView] = useState<"day" | "week" | "agenda">("week");
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "1");
  const [selected, setSelected] = useState<AdminDiaryAppointment | null>(
    appointments.find((item) => item.id === searchParams.get("appointment")) ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);

  async function createAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        fieldErrors?: Record<string, string[] | undefined>;
      } | null;
      if (!response.ok) {
        const fieldLabels: Record<string, string> = {
          type: "Appointment type",
          date: "Date",
          startTime: "Start time",
          durationMinutes: "Duration",
          customerName: "Customer name",
          phone: "Phone number",
          registration: "Registration",
          internalNote: "Internal note",
        };
        const firstBad = Object.entries(result?.fieldErrors ?? {}).find(
          ([, issues]) => (issues?.length ?? 0) > 0,
        );
        if (firstBad) {
          const [name, issues] = firstBad;
          setMessage(
            `${fieldLabels[name] ?? name}: ${issues?.[0] ?? "please review"}.`,
          );
        } else {
          setMessage(
            result?.message ??
              "The appointment could not be booked. The slot has not been held.",
          );
        }
        return;
      }
      setMessage("Appointment created and availability updated.");
      router.refresh();
      window.setTimeout(() => setCreateOpen(false), 700);
    } catch {
      setMessage("DealerOS could not check the slot. No appointment was created.");
    } finally {
      setSaving(false);
    }
  }

  async function updateSelectedAppointment(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    if (!selected) return false;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/appointments/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        appointment?: { status?: string };
      } | null;
      if (!response.ok) {
        setMessage(result?.message ?? "The appointment could not be updated.");
        return false;
      }
      if (result?.appointment?.status) {
        const status = result.appointment.status
          .replaceAll("_", " ")
          .replace(/^\w/, (character) => character.toUpperCase());
        setSelected((current) => (current ? { ...current, status } : current));
      }
      setMessage(successMessage);
      router.refresh();
      return true;
    } catch {
      setMessage("DealerOS could not reach the server. The appointment was unchanged.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function convertSelectedAppointment() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/appointments/${selected.id}/convert-to-repair`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            internalNote: noteRef.current?.value || null,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        repairJob?: { id?: string };
      } | null;
      if (!response.ok || !result?.repairJob?.id) {
        setMessage(result?.message ?? "The repair job could not be created.");
        return;
      }
      router.push(`/admin/repairs/${result.repairJob.id}`);
      router.refresh();
    } catch {
      setMessage("DealerOS could not create the repair job.");
    } finally {
      setSaving(false);
    }
  }

  const tones: Record<string, string> = {
    blue: "border-blue-300 bg-blue-50 text-blue-950",
    green: "border-emerald-300 bg-emerald-50 text-emerald-950",
    amber: "border-amber-300 bg-amber-50 text-amber-950",
  };

  function navigateWeek(daysToAdd: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(
      "week",
      format(addDays(weekStartDate, daysToAdd), "yyyy-MM-dd"),
    );
    router.push(`/admin/diary?${params.toString()}`);
  }

  function showCurrentWeek() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("week");
    router.push(
      params.size ? `/admin/diary?${params.toString()}` : "/admin/diary",
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigateWeek(-7)}
              className="grid size-9 place-items-center rounded-lg hover:bg-surface-muted"
              aria-label="Previous week"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => navigateWeek(7)}
              className="grid size-9 place-items-center rounded-lg hover:bg-surface-muted"
              aria-label="Next week"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              className="h-9 rounded-lg border px-3 text-xs font-extrabold"
              onClick={showCurrentWeek}
            >
              Today
            </button>
          </div>
          <h2 className="text-sm font-extrabold sm:ml-2">
            {format(weekStartDate, "d MMM")}–{format(weekEndDate, "d MMM yyyy")}
          </h2>
          <div className="flex rounded-xl bg-surface-muted p-1 sm:ml-auto">
            {(["day", "week", "agenda"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={cn(
                  "h-8 rounded-lg px-3 text-[10px] font-extrabold capitalize",
                  view === option ? "bg-white shadow-sm" : "text-foreground/40",
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            New appointment
          </Button>
        </div>

        {message ? (
          <p role="status" className="rounded-xl bg-brand-soft px-4 py-3 text-xs font-bold text-brand-strong">
            {message}
          </p>
        ) : null}

        {view === "week" ? (
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[70px_repeat(7,1fr)] border-b">
                <div className="border-r" />
                {days.map((day) => (
                  <div
                    key={day.iso}
                    className={cn(
                      "border-r p-3 text-center last:border-r-0",
                      day.iso === today && "bg-brand-soft/40",
                    )}
                  >
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/38">
                      {day.day}
                    </p>
                    <p
                      className={cn(
                        "mx-auto mt-1 grid size-7 place-items-center rounded-full text-xs font-extrabold",
                        day.iso === today && "bg-brand text-white",
                      )}
                    >
                      {day.date}
                    </p>
                  </div>
                ))}
              </div>
              <div className="relative grid grid-cols-[70px_repeat(7,1fr)]">
                <div>
                  {hourRows.map((hour) => (
                    <div key={hour} className="h-16 border-b border-r px-2 pt-2 text-right text-[9px] font-bold text-foreground/30">
                      {hour}
                    </div>
                  ))}
                </div>
                {days.map((day) => (
                  <div
                    key={day.iso}
                    className={cn(
                      "relative border-r last:border-r-0",
                      day.iso === today && "bg-brand-soft/15",
                    )}
                  >
                    {hourRows.map((hour) => (
                      <div key={hour} className="h-16 border-b" />
                    ))}
                    {appointments
                      .filter((appointment) => appointment.date === day.iso)
                      .filter((appointment) => {
                        const hour = Number(appointment.time.slice(0, 2));
                        return hour >= 8 && hour < 18;
                      })
                      .map((appointment) => {
                        const [hour, minute] = appointment.time
                          .split(":")
                          .map(Number);
                        const top =
                          (((hour ?? 8) * 60 + (minute ?? 0) - 8 * 60) / 60) *
                          64;
                        const height = Math.max(
                          38,
                          (appointment.durationMinutes / 60) * 64,
                        );
                        return (
                          <button
                            key={appointment.id}
                            type="button"
                            onClick={() => setSelected(appointment)}
                            className={cn(
                              "absolute left-1 right-1 rounded-lg border-l-2 p-2 text-left shadow-sm transition hover:z-10 hover:shadow-md",
                              tones[appointment.tone],
                            )}
                            style={{
                              top: `${top}px`,
                              minHeight: `${height}px`,
                            }}
                          >
                            <p className="truncate text-[9px] font-extrabold">
                              {appointment.time} · {appointment.title}
                            </p>
                            <p className="mt-0.5 truncate text-[8px] opacity-60">{appointment.customer}</p>
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {view === "day" ? (
          <div className="rounded-2xl border bg-white">
            <div className="border-b p-4">
              <h2 className="text-sm font-extrabold">{selectedDay.label}</h2>
              <p className="mt-1 text-[10px] text-foreground/40">
                {
                  appointments.filter(
                    (appointment) => appointment.date === selectedDay.iso,
                  ).length
                }{" "}
                appointments ·{" "}
                {
                  new Set(
                    appointments
                      .filter(
                        (appointment) => appointment.date === selectedDay.iso,
                      )
                      .map((appointment) => appointment.staff),
                  ).size
                }{" "}
                staff working
              </p>
            </div>
            <div className="divide-y">
              {appointments
                .filter((appointment) => appointment.date === selectedDay.iso)
                .map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => setSelected(appointment)}
                  className="grid w-full gap-3 p-4 text-left hover:bg-[#fafaf8] sm:grid-cols-[80px_1fr_150px] sm:items-center"
                >
                  <span className="text-sm font-extrabold">{appointment.time}</span>
                  <span className={cn("rounded-lg border-l-2 p-3", tones[appointment.tone])}>
                    <span className="block text-xs font-extrabold">{appointment.title}</span>
                    <span className="mt-1 block text-[10px] opacity-60">{appointment.customer}</span>
                  </span>
                  <span className="text-xs font-semibold text-foreground/45">{appointment.staff}</span>
                </button>
                ))}
              {!appointments.some(
                (appointment) => appointment.date === selectedDay.iso,
              ) ? (
                <p className="p-12 text-center text-xs text-foreground/40">
                  No appointments on this day.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {view === "agenda" ? (
          <div className="space-y-4">
            {days.map((day) => {
              const entries = appointments.filter(
                (appointment) => appointment.date === day.iso,
              );
              return (
              <section key={day.iso} className="rounded-2xl border bg-white">
                <h2 className="border-b p-4 text-xs font-extrabold">
                  {day.iso === today ? "Today · " : ""}
                  {day.label}
                </h2>
                <div className="divide-y">
                  {entries.map((appointment) => (
                    <button
                      key={`${day.iso}-${appointment.id}`}
                      type="button"
                      onClick={() => setSelected(appointment)}
                      className="flex w-full items-center gap-4 p-4 text-left hover:bg-[#fafaf8]"
                    >
                      <span className="w-12 text-xs font-extrabold">{appointment.time}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-extrabold">{appointment.title}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-foreground/45">
                          {appointment.customer}
                        </span>
                      </span>
                      <span className="text-[10px] font-bold text-foreground/40">{appointment.staff}</span>
                    </button>
                  ))}
                  {!entries.length ? (
                    <p className="p-5 text-center text-[10px] text-foreground/35">
                      No appointments
                    </p>
                  ) : null}
                </div>
              </section>
              );
            })}
          </div>
        ) : null}
      </div>

      {selected ? (
        <>
          <button
            className="fixed inset-0 z-[55] bg-[#09100e]/30"
            onClick={() => setSelected(null)}
            aria-label="Close appointment"
          />
          <aside className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex h-[76px] items-center justify-between border-b px-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand">Appointment</p>
                <h2 className="mt-1 font-extrabold">{selected.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 hover:bg-surface-muted"
                aria-label="Close appointment"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className={cn("rounded-xl border-l-4 p-4", tones[selected.tone])}>
                <p className="text-sm font-extrabold">
                  {selected.dateLabel} · {selected.time}
                </p>
                <p className="mt-1 text-xs opacity-60">
                  {selected.duration} · {timezone}
                </p>
              </div>
              <section className="space-y-3 rounded-xl border p-4">
                <p className="flex items-center gap-2 text-xs font-bold">
                  <UserRound className="size-4 text-brand" />
                  {selected.customer}
                </p>
                <p className="flex items-center gap-2 text-xs font-bold">
                  <CalendarDays className="size-4 text-brand" />
                  Assigned to {selected.staff}
                </p>
                <p className="flex items-center gap-2 text-xs font-bold">
                  <Clock3 className="size-4 text-brand" />
                  {selected.status}
                </p>
              </section>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={
                    selected.phone
                      ? `tel:${selected.phone.replace(/\s/g, "")}`
                      : undefined
                  }
                  aria-disabled={!selected.phone}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-xl bg-brand text-xs font-extrabold text-white",
                    !selected.phone && "pointer-events-none opacity-45",
                  )}
                >
                  <Phone className="size-4" />
                  Call customer
                </a>
                <button
                  type="button"
                  onClick={() =>
                    void updateSelectedAppointment(
                      { status: "call_completed" },
                      "Appointment marked complete.",
                    )
                  }
                  disabled={saving}
                  className="h-10 rounded-xl border text-xs font-extrabold"
                >
                  Mark completed
                </button>
              </div>
              <label className="text-xs font-extrabold">
                Internal appointment note
                <Textarea
                  ref={noteRef}
                  key={selected.id}
                  className="mt-2"
                  defaultValue={selected.internalNote ?? ""}
                  placeholder="No internal note has been added."
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  void updateSelectedAppointment(
                    { internalNotes: noteRef.current?.value ?? "" },
                    "Internal note saved.",
                  )
                }
                disabled={saving}
              >
                Save note
              </Button>
            </div>
            <div className="border-t p-4">
              <Button
                type="button"
                className="w-full"
                onClick={() => void convertSelectedAppointment()}
                disabled={saving}
              >
                <Wrench />
                Convert to repair job
              </Button>
            </div>
          </aside>
        </>
      ) : null}

      {createOpen ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[#09100e]/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-appointment-title"
        >
          <form onSubmit={createAppointment} className="my-8 w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand">Diary</p>
                <h2 id="create-appointment-title" className="mt-1 font-extrabold">
                  Create appointment
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-2 hover:bg-surface-muted"
                aria-label="Close appointment form"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="text-xs font-extrabold">
                Appointment type
                <select name="type" className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm">
                  <option>Repair discussion call</option>
                  <option>Vehicle viewing</option>
                  <option>Test drive</option>
                  <option>Sourcing requirements</option>
                  <option>Blocked time</option>
                </select>
              </label>
              <label className="text-xs font-extrabold">
                Assigned staff
                <select name="staffId" className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm">
                  <option value="">Unassigned</option>
                  {staffOptions.map((staffMember) => (
                    <option key={staffMember.id} value={staffMember.name}>
                      {staffMember.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-extrabold">
                Date
                <Input
                  name="date"
                  type="date"
                  defaultValue={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                  className="mt-1.5"
                  required
                />
              </label>
              <label className="text-xs font-extrabold">
                Start time
                <Input name="startTime" type="time" defaultValue="10:00" className="mt-1.5" required />
              </label>
              <label className="text-xs font-extrabold">
                Duration
                <select name="durationMinutes" className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm">
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </label>
              <label className="text-xs font-extrabold">
                Customer
                <Input name="customerName" className="mt-1.5" required />
              </label>
              <label className="text-xs font-extrabold">
                Telephone
                <Input name="phone" type="tel" className="mt-1.5" required />
              </label>
              <label className="text-xs font-extrabold">
                Registration
                <Input name="registration" className="mt-1.5 uppercase" />
              </label>
              <label className="text-xs font-extrabold sm:col-span-2">
                Internal note
                <Textarea name="internalNote" className="mt-1.5" />
              </label>
            </div>
            {message ? <p role="status" className="mx-5 rounded-lg bg-surface-muted p-3 text-xs">{message}</p> : null}
            <div className="flex justify-end gap-2 border-t p-4">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="animate-spin" /> : <CalendarDays />}
                Check slot and create
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
