"use client";

import { useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const roleValues: Record<string, string> = {
  Owner: "owner",
  Manager: "manager",
  Salesperson: "salesperson",
  "Service advisor": "service_advisor",
  Technician: "technician",
  "Website editor": "website_editor",
};

export function TeamMemberControls({
  id,
  role,
  status,
}: {
  id: string;
  role: string;
  status: string;
}) {
  const router = useRouter();
  const [nextRole, setNextRole] = useState(roleValues[role] ?? "salesperson");
  const [nextStatus, setNextStatus] = useState(
    status === "Active" ? "active" : "suspended",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/team/members/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: nextRole, status: nextStatus }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    setMessage(result?.message ?? "Team access could not be updated.");
    setSaving(false);
    if (response?.ok) router.refresh();
  }

  return (
    <div className="flex min-w-[310px] flex-wrap items-center gap-2">
      <select
        value={nextRole}
        onChange={(event) => setNextRole(event.target.value)}
        className="h-9 rounded-lg border bg-white px-2 text-[10px] font-bold"
        aria-label="Team member role"
      >
        {Object.entries(roleValues).map(([label, value]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={nextStatus}
        onChange={(event) => setNextStatus(event.target.value)}
        className="h-9 rounded-lg border bg-white px-2 text-[10px] font-bold"
        aria-label="Team member status"
      >
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void save()}
        disabled={saving}
      >
        {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
        Save
      </Button>
      {message ? (
        <span className="basis-full text-[9px] font-semibold text-foreground/50" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}
