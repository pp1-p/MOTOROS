"use client";

import { useState } from "react";
import { LoaderCircle, PauseCircle, PlayCircle } from "lucide-react";

type DealershipStatus = "active" | "suspended";

export function DealershipStatusControl({
  dealershipId,
  initialStatus,
  canManage,
}: {
  dealershipId: string;
  initialStatus: string;
  canManage: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const nextStatus: DealershipStatus =
    status === "suspended" ? "active" : "suspended";

  async function changeStatus() {
    const verb = nextStatus === "suspended" ? "suspend" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${verb} this dealership?`)) {
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/platform/dealerships/${dealershipId}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            reason: `Changed from the MOTOR.OS platform control centre`,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { message?: string; status?: string }
        | null;
      if (!response.ok) {
        setMessage(result?.message ?? "The dealership status could not be changed.");
        return;
      }
      setStatus(result?.status ?? nextStatus);
      setMessage(result?.message ?? "Dealership status updated.");
    } catch {
      setMessage("MOTOR.OS could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
        Add your Auth user to <code>platform_admins</code> before changing
        dealership status. Email allow-list access is read-only.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={changeStatus}
        disabled={saving}
        className={
          nextStatus === "suspended"
            ? "inline-flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-extrabold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
            : "inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
        }
      >
        {saving ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : nextStatus === "suspended" ? (
          <PauseCircle className="size-4" aria-hidden />
        ) : (
          <PlayCircle className="size-4" aria-hidden />
        )}
        {saving
          ? "Updating…"
          : nextStatus === "suspended"
            ? "Suspend dealership"
            : "Reactivate dealership"}
      </button>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}
