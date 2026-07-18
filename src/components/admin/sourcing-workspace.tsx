"use client";

import { useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, MoreHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AdminSourcingListItem } from "@/lib/types/admin-operational";

const stages = [
  {
    title: "New & confirming",
    statuses: ["New", "Contact attempted", "Requirements confirmed"],
  },
  {
    title: "Search active",
    statuses: ["Search active", "Options found", "Inspection required"],
  },
  {
    title: "Customer decision",
    statuses: ["Option sent to customer", "Negotiation", "Deposit requested"],
  },
  {
    title: "Secured & preparing",
    statuses: ["Vehicle secured", "Preparing vehicle", "Completed"],
  },
];
const statuses = [
  ["new", "New"],
  ["contact_attempted", "Contact attempted"],
  ["requirements_confirmed", "Requirements confirmed"],
  ["search_active", "Search active"],
  ["options_found", "Options found"],
  ["option_sent", "Option sent to customer"],
  ["inspection_required", "Inspection required"],
  ["negotiation", "Negotiation"],
  ["deposit_requested", "Deposit requested"],
  ["vehicle_secured", "Vehicle secured"],
  ["preparing_vehicle", "Preparing vehicle"],
  ["completed", "Completed"],
  ["paused", "Paused"],
  ["lost", "Lost"],
] as const;

export function SourcingWorkspace({
  requests,
  canManage,
  initialRequest,
}: {
  requests: AdminSourcingListItem[];
  canManage: boolean;
  initialRequest?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "high">("all");
  const [selected, setSelected] = useState<AdminSourcingListItem | null>(() =>
    requests.find(
      (request) =>
        request.id === initialRequest || request.reference === initialRequest,
    ) ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const visible = useMemo(
    () =>
      filter === "high"
        ? requests.filter((request) =>
            ["High", "Urgent"].includes(request.priority),
          )
        : requests,
    [filter, requests],
  );

  async function updateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canManage) return;
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const sourcingFee = String(form.get("sourcingFee") ?? "").trim();
    const expectedMargin = String(form.get("expectedMargin") ?? "").trim();
    const payload = {
      status: String(form.get("status") ?? "new"),
      priority: String(form.get("priority") ?? "normal"),
      note: String(form.get("note") ?? "").trim() || undefined,
      sourcingFee: sourcingFee ? Number(sourcingFee) : undefined,
      expectedMargin: expectedMargin ? Number(expectedMargin) : undefined,
    };
    try {
      const response = await fetch(`/api/sourcing/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        sourcing?: {
          status?: string;
          priority?: string;
          sourcing_fee?: number | null;
          expected_margin?: number | null;
        };
      } | null;
      if (!response.ok) {
        setMessage(result?.message ?? "The sourcing request could not be updated.");
        return;
      }
      const status = result?.sourcing?.status
        ?.replaceAll("_", " ")
        .replace(/^\w/, (character) => character.toUpperCase());
      const priority = result?.sourcing?.priority
        ?.replace(/^\w/, (character) => character.toUpperCase());
      setSelected((current) =>
        current
          ? {
              ...current,
              status: status ?? current.status,
              priority: priority ?? current.priority,
              sourcingFee: result?.sourcing?.sourcing_fee ?? current.sourcingFee,
              expectedMargin:
                result?.sourcing?.expected_margin ?? current.expectedMargin,
            }
          : current,
      );
      setMessage("Sourcing request and activity timeline updated.");
      router.refresh();
    } catch {
      setMessage("DealerOS could not reach the server. The request was unchanged.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-xl border bg-white p-2">
        <Button
          type="button"
          variant={filter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All open
        </Button>
        <Button
          type="button"
          variant={filter === "high" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setFilter("high")}
        >
          High priority
        </Button>
      </div>
      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1050px] grid-cols-4 gap-3">
          {stages.map((stage) => {
            const stageRequests = visible.filter((request) =>
              stage.statuses.includes(request.status),
            );
            return (
              <section key={stage.title} className="rounded-2xl bg-[#e9ebe7] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xs font-extrabold">{stage.title}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold">
                    {stageRequests.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {stageRequests.map((request) => (
                    <button
                      type="button"
                      key={request.id}
                      onClick={() => {
                        setSelected(request);
                        setMessage("");
                      }}
                      className="block w-full rounded-xl border bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[9px] font-extrabold text-brand">
                          {request.reference}
                        </span>
                        <MoreHorizontal className="size-4 text-foreground/30" />
                      </div>
                      <h3 className="mt-2 text-xs font-extrabold">{request.customer}</h3>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-foreground/48">
                        {request.brief}
                      </p>
                      <div className="mt-3">
                        <StatusPill status={request.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 border-t pt-2 text-[9px]">
                        <div>
                          <p className="text-foreground/35">Budget</p>
                          <p className="font-extrabold">{request.budget}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-foreground/35">Candidates</p>
                          <p className="font-extrabold">{request.candidates}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[9px] font-semibold text-foreground/35">
                        {request.owner} · {request.updated}
                      </p>
                    </button>
                  ))}
                  {!stageRequests.length ? (
                    <div className="rounded-xl border border-dashed border-foreground/10 bg-white/45 p-5 text-center text-[10px] text-foreground/35">
                      No requests in this stage
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {selected ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] bg-[#09100e]/30"
            onClick={() => setSelected(null)}
            aria-label="Close sourcing request"
          />
          <aside className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-lg flex-col bg-white shadow-2xl">
            <div className="flex h-[76px] items-center justify-between border-b px-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand">
                  {selected.reference}
                </p>
                <h2 className="mt-1 font-extrabold">{selected.customer}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 hover:bg-surface-muted"
                aria-label="Close sourcing request"
              >
                <X className="size-5" />
              </button>
            </div>
            <form
              key={selected.id}
              onSubmit={updateRequest}
              className="flex-1 overflow-y-auto p-5"
            >
              <p className="rounded-xl bg-surface-muted p-4 text-xs leading-5">
                {selected.brief}
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-extrabold">
                  Stage
                  <select
                    name="status"
                    disabled={!canManage}
                    defaultValue={
                      statuses.find(([, label]) => label === selected.status)?.[0] ??
                      "new"
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
                  >
                    {statuses.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-extrabold">
                  Priority
                  <select
                    name="priority"
                    disabled={!canManage}
                    defaultValue={selected.priority.toLowerCase()}
                    className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                {canManage ? (
                  <>
                    <label className="text-xs font-extrabold">
                      Sourcing fee
                      <Input
                        name="sourcingFee"
                        type="number"
                        min={0}
                        defaultValue={selected.sourcingFee ?? ""}
                        className="mt-1.5"
                      />
                    </label>
                    <label className="text-xs font-extrabold">
                      Expected margin
                      <Input
                        name="expectedMargin"
                        type="number"
                        defaultValue={selected.expectedMargin ?? ""}
                        className="mt-1.5"
                      />
                    </label>
                  </>
                ) : null}
              </div>
              <label
                className="mt-5 block text-xs font-extrabold"
                hidden={!canManage}
              >
                Activity note
                <Textarea
                  name="note"
                  disabled={!canManage}
                  className="mt-1.5"
                  placeholder="Decision, supplier update or next action…"
                />
              </label>
              {!canManage ? (
                <p className="mt-5 rounded-xl bg-surface-muted p-3 text-xs text-foreground/60">
                  This request is view-only for your role. An owner or manager can update its
                  stage, priority and commercial details.
                </p>
              ) : null}
              {message ? (
                <p role="status" className="mt-4 rounded-xl bg-brand-soft p-3 text-xs font-bold">
                  {message}
                </p>
              ) : null}
              {canManage ? (
                <Button type="submit" className="mt-5 w-full" disabled={saving}>
                  {saving ? <LoaderCircle className="animate-spin" /> : null}
                  Save sourcing update
                </Button>
              ) : null}
            </form>
          </aside>
        </>
      ) : null}
    </>
  );
}
