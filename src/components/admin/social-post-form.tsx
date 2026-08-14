"use client";

import { useState } from "react";
import { CalendarClock, LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { Notice } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/lib/notify";

type ConnectionOption = {
  id: string;
  name: string;
  account: string | null;
};

type VehicleOption = {
  id: string;
  label: string;
  registration: string | null;
};

export function SocialPostForm({
  connections,
  vehicles,
  canPublish,
  entitled,
}: {
  connections: ConnectionOption[];
  vehicles: VehicleOption[];
  canPublish: boolean;
  entitled: boolean;
}) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [callToAction, setCallToAction] = useState("");
  const [connectionIds, setConnectionIds] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [saving, setSaving] = useState<"draft" | "scheduled" | null>(null);
  const [minimumSchedule] = useState(() =>
    new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16),
  );

  const disabled = !canPublish || !entitled;

  function toggleConnection(connectionId: string) {
    setConnectionIds((current) =>
      current.includes(connectionId)
        ? current.filter((id) => id !== connectionId)
        : [...current, connectionId],
    );
  }

  async function submit(status: "draft" | "scheduled") {
    if (disabled) return;
    if (!caption.trim()) {
      notify.error("Add a caption before saving the post.");
      return;
    }
    if (status === "scheduled" && (!scheduledFor || connectionIds.length === 0)) {
      notify.error("Choose a future time and at least one connected channel.");
      return;
    }

    setSaving(status);
    try {
      const response = await fetch("/api/admin/social/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caption,
          callToAction: callToAction || null,
          vehicleId: vehicleId || null,
          connectionIds,
          status,
          scheduledFor:
            status === "scheduled" ? new Date(scheduledFor).toISOString() : null,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        notify.error(result?.message ?? "The social post could not be saved.");
        return;
      }
      notify.success(result?.message ?? "Social post saved.");
      setCaption("");
      setVehicleId("");
      setCallToAction("");
      setConnectionIds([]);
      setScheduledFor("");
      router.push("/admin/social/calendar");
      router.refresh();
    } catch {
      notify.error("MOTOR.OS could not reach the server. Your caption remains on screen.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5">
      {!entitled ? (
        <Notice title="Professional plan required">
          Social publishing is controlled by the dealership subscription. An owner can
          ask the platform team to enable the feature or change plan.
        </Notice>
      ) : null}
      {entitled && !canPublish ? (
        <Notice title="Publishing permission required">
          You can review the social hub, calendar and inbox, but only an owner or manager
          can save publishing drafts and schedules.
        </Notice>
      ) : null}
      <section className="rounded-2xl border bg-white p-5">
        <label className="block text-sm font-extrabold">
          Caption
          <Textarea
            className="mt-2 min-h-44"
            disabled={disabled}
            maxLength={5000}
            placeholder="Tell customers what makes this vehicle worth a closer look…"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />
        </label>
        <p className="mt-1 text-right text-[10px] text-foreground/40">
          {caption.length.toLocaleString("en-GB")} / 5,000
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <label className="block text-xs font-extrabold">
            Link a public vehicle (optional)
            <select
              className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm"
              disabled={disabled}
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
            >
              <option value="">No vehicle selected</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                  {vehicle.registration ? ` · ${vehicle.registration}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-extrabold">
            Call to action (optional)
            <Input
              className="mt-2"
              disabled={disabled}
              maxLength={120}
              placeholder="Book a viewing"
              value={callToAction}
              onChange={(event) => setCallToAction(event.target.value)}
            />
          </label>
          <label className="block text-xs font-extrabold">
            Schedule time
            <input
              className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm"
              disabled={disabled}
              min={minimumSchedule}
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-extrabold">Publishing channels</h2>
        <p className="mt-1 text-xs leading-5 text-foreground/50">
          Only connected accounts with a declared publishing capability are selectable.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {connections.map((connection) => (
            <label
              key={connection.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border p-3"
            >
              <input
                checked={connectionIds.includes(connection.id)}
                className="mt-1"
                disabled={disabled}
                type="checkbox"
                onChange={() => toggleConnection(connection.id)}
              />
              <span>
                <span className="block text-xs font-extrabold">{connection.name}</span>
                <span className="mt-0.5 block text-[10px] text-foreground/45">
                  {connection.account ?? "Connected account"}
                </span>
              </span>
            </label>
          ))}
          {!connections.length ? (
            <p className="sm:col-span-2 rounded-xl border border-dashed p-4 text-xs text-foreground/50">
              No publish-capable account is connected. Drafts can still be saved, but a
              schedule needs a real provider connection.
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t pt-5">
          <Button
            disabled={disabled || saving !== null}
            size="sm"
            variant="outline"
            onClick={() => void submit("draft")}
          >
            {saving === "draft" ? <LoaderCircle className="animate-spin" /> : <Save />}
            Save draft
          </Button>
          <Button
            disabled={disabled || saving !== null || connections.length === 0}
            size="sm"
            onClick={() => void submit("scheduled")}
          >
            {saving === "scheduled" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <CalendarClock />
            )}
            Add to calendar
          </Button>
        </div>
      </section>
    </div>
  );
}
