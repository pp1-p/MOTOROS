"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Columns3,
  Filter,
  LayoutList,
  LoaderCircle,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { Avatar, StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  AdminLeadList,
  AdminLeadListItem,
} from "@/lib/types/admin-operational";
import { cn } from "@/lib/utils";

const columns = ["New", "Contact attempted", "Appointment booked", "Qualified", "Negotiation", "Won"];

export function LeadsWorkspace({
  leads,
  metrics,
}: {
  leads: AdminLeadListItem[];
  metrics: AdminLeadList["metrics"];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"table" | "kanban">("table");
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [quickFilter, setQuickFilter] = useState<
    "all" | "new" | "mine" | "due" | "priority"
  >("all");
  const [selected, setSelected] = useState<AdminLeadListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "1");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [leadNote, setLeadNote] = useState("");
  const [updatingLead, setUpdatingLead] = useState(false);

  const filtered = useMemo(
    () =>
      leads.filter((lead) => {
        const matchesSearch = `${lead.name} ${lead.subject} ${lead.source} ${lead.id} ${lead.reference} ${lead.status}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesQuickFilter =
          quickFilter === "all" ||
          (quickFilter === "new" && lead.status === "New") ||
          (quickFilter === "mine" && lead.assignedToMe) ||
          (quickFilter === "due" && lead.followUpDue) ||
          (quickFilter === "priority" &&
            ["High", "Urgent"].includes(lead.priority));
        return matchesSearch && matchesQuickFilter;
      }),
    [leads, query, quickFilter],
  );

  async function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const subject = String(form.get("subject") ?? "");
    const notes = String(form.get("notes") ?? "");
    const requestedType = String(form.get("type") ?? "general_enquiry");
    const allowedTypes = [
      "vehicle_enquiry",
      "callback_request",
      "test_drive",
      "part_exchange",
      "general_enquiry",
    ];
    const payload = {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      message: [subject, notes].filter(Boolean).join("\n\n"),
      enquiryType: allowedTypes.includes(requestedType) ? requestedType : "general_enquiry",
      preferredContact: "either",
      consent: true,
      marketingConsent: false,
      source: String(form.get("source") ?? "staff_created"),
      website: "",
    };
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setMessage(result?.message ?? "The lead could not be saved. Your details remain on screen.");
        return;
      }
      setMessage("Lead created and added to the New queue.");
      router.refresh();
      window.setTimeout(() => setCreateOpen(false), 700);
    } catch {
      setMessage("DealerOS could not reach the server. No lead was created.");
    } finally {
      setCreating(false);
    }
  }

  async function updateSelectedLead(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    if (!selected) return;
    setUpdatingLead(true);
    setMessage("");
    try {
      const response = await fetch(`/api/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        lead?: { status?: string };
      } | null;
      if (!response.ok) {
        setMessage(result?.message ?? "The lead could not be updated.");
        return;
      }
      if (result?.lead?.status) {
        const displayStatus = result.lead.status
          .replaceAll("_", " ")
          .replace(/^\w/, (character) => character.toUpperCase());
        setSelected((current) =>
          current ? { ...current, status: displayStatus } : current,
        );
      }
      setMessage(successMessage);
      router.refresh();
    } catch {
      setMessage("DealerOS could not reach the server. The lead was unchanged.");
    } finally {
      setUpdatingLead(false);
    }
  }

  async function saveLeadNote() {
    const note = leadNote.trim();
    if (!note) {
      setMessage("Enter a note before saving.");
      return;
    }
    await updateSelectedLead(
      { note },
      "Note added to the lead activity timeline.",
    );
    setLeadNote("");
  }

  async function advanceLead() {
    if (!selected) return;
    const order = [
      "new",
      "contact_attempted",
      "appointment_booked",
      "qualified",
      "negotiation",
      "won",
    ] as const;
    const current = selected.status.toLowerCase().replaceAll(" ", "_");
    const currentIndex = order.indexOf(current as (typeof order)[number]);
    const next = order[Math.min(currentIndex + 1, order.length - 1)];
    if (!next || current === "won") {
      setMessage("This lead is already at the final won stage.");
      return;
    }
    await updateSelectedLead(
      { status: next },
      `Lead moved to ${next.replaceAll("_", " ")}.`,
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search leads, customer or vehicle…"
              className="h-10 border-0 bg-surface-muted pl-9 shadow-none"
              aria-label="Search leads"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setQuery("")}>
            <Filter />
            Clear filter
          </Button>
          <div className="flex rounded-xl bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => setView("table")}
              aria-label="Table view"
              aria-pressed={view === "table"}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-extrabold",
                view === "table" ? "bg-white shadow-sm" : "text-foreground/40",
              )}
            >
              <LayoutList className="size-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              aria-label="Kanban view"
              aria-pressed={view === "kanban"}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-extrabold",
                view === "kanban" ? "bg-white shadow-sm" : "text-foreground/40",
              )}
            >
              <Columns3 className="size-3.5" />
              Kanban
            </button>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Add lead
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All open", metrics.open],
            [
              "new",
              "New",
              leads.filter((lead) => lead.status === "New").length,
            ],
            ["mine", "My leads", metrics.mine],
            ["due", "Follow-up due", metrics.followUpDue],
            ["priority", "High priority", metrics.highPriority],
          ].map(([id, label, count]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() =>
                setQuickFilter(
                  id as "all" | "new" | "mine" | "due" | "priority",
                )
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-[10px] font-extrabold transition",
                quickFilter === id
                  ? "border-brand bg-brand-soft text-brand-strong"
                  : "bg-white text-foreground/50",
              )}
            >
              {label} <span className="ml-1 opacity-60">{count}</span>
            </button>
          ))}
        </div>

        {view === "table" ? (
          <div className="overflow-hidden rounded-2xl border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="border-b bg-[#fafaf8] text-[10px] font-extrabold uppercase tracking-[0.1em] text-foreground/38">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Enquiry</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Next action</th>
                    <th className="px-4 py-3">Potential value</th>
                    <th className="w-12 px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelected(lead)}
                      className="cursor-pointer transition hover:bg-[#fafaf8]"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="flex items-center gap-3 text-left"
                          onClick={() => setSelected(lead)}
                        >
                          <Avatar
                            initials={lead.name
                              .split(" ")
                              .map((part) => part[0])
                              .join("")}
                          />
                          <span>
                            <span className="block text-xs font-extrabold">{lead.name}</span>
                            <span className="text-[10px] text-foreground/40">{lead.reference}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold">{lead.subject}</p>
                        <p className="mt-0.5 text-[10px] text-foreground/40">{lead.source}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={lead.status} />
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-foreground/55">
                        {lead.owner}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-bold", lead.due.includes("Today") && "text-amber-700")}>
                          {lead.due}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-extrabold">{lead.value}</td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(lead);
                          }}
                          className="grid size-8 place-items-center rounded-lg hover:bg-surface-muted"
                          aria-label={`Open ${lead.name} lead`}
                        >
                          <MoreHorizontal className="size-4 text-foreground/35" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-3">
            <div className="grid min-w-[1320px] grid-cols-6 gap-3">
              {columns.map((column) => {
                const items = filtered.filter((lead) => lead.status === column);
                return (
                  <section key={column} className="rounded-2xl bg-[#eaece8] p-2.5">
                    <div className="flex items-center justify-between px-1 pb-2.5">
                      <h2 className="text-[11px] font-extrabold">{column}</h2>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-extrabold text-foreground/45">
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {items.map((lead) => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => setSelected(lead)}
                          className="block w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-extrabold">{lead.name}</p>
                            {lead.priority === "High" ? (
                              <span className="size-2 rounded-full bg-red-500" title="High priority" />
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-foreground/45">
                            {lead.subject}
                          </p>
                          <div className="mt-3 flex items-center justify-between border-t pt-2">
                            <span className="text-[9px] font-bold text-foreground/35">{lead.owner}</span>
                            <span className="text-[9px] font-extrabold">{lead.value}</span>
                          </div>
                        </button>
                      ))}
                      {!items.length ? (
                        <div className="rounded-xl border border-dashed border-foreground/10 p-5 text-center text-[10px] text-foreground/30">
                          No leads
                        </div>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selected ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] bg-[#09100e]/30"
            onClick={() => setSelected(null)}
            aria-label="Close lead detail"
          />
          <aside className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-lg flex-col bg-white shadow-2xl">
            <div className="flex h-[76px] items-center justify-between border-b px-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand">
                  {selected.reference}
                </p>
                <h2 className="mt-1 font-extrabold">{selected.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-foreground/40 hover:bg-surface-muted"
                aria-label="Close lead detail"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={selected.status} />
                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold capitalize">
                  {selected.priority} priority
                </span>
              </div>
              <h3 className="mt-5 text-lg font-extrabold">{selected.subject}</h3>
              <p className="mt-1 text-xs text-foreground/45">
                {selected.source} · Estimated opportunity {selected.value}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <a
                  href={selected.phone ? `tel:${selected.phone.replace(/\s/g, "")}` : undefined}
                  aria-disabled={!selected.phone}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-xl bg-brand text-xs font-extrabold text-white",
                    !selected.phone && "pointer-events-none opacity-45",
                  )}
                >
                  <Phone className="size-3.5" />
                  Call
                </a>
                <a
                  href={selected.email ? `mailto:${selected.email}` : undefined}
                  aria-disabled={!selected.email}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-extrabold",
                    !selected.email && "pointer-events-none opacity-45",
                  )}
                >
                  <Mail className="size-3.5" />
                  Email
                </a>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("leadNote")?.focus()
                  }
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-extrabold"
                >
                  <MessageSquare className="size-3.5" />
                  Note
                </button>
              </div>
              <section className="mt-6 rounded-xl border p-4">
                <h3 className="text-xs font-extrabold">Next action</h3>
                <div className="mt-3 flex gap-3">
                  <CalendarClock className="size-4 text-brand" />
                  <div>
                    <p className="text-xs font-bold">{selected.due}</p>
                    <p className="mt-1 text-[10px] text-foreground/42">
                      Follow up about availability and part exchange.
                    </p>
                  </div>
                </div>
              </section>
              <div className="mt-6">
                <label htmlFor="leadNote" className="text-xs font-extrabold">
                  Add an internal note
                </label>
                <Textarea
                  id="leadNote"
                  className="mt-2"
                  value={leadNote}
                  onChange={(event) => setLeadNote(event.target.value)}
                  placeholder="Add context for the next person…"
                />
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  onClick={() => void saveLeadNote()}
                  disabled={updatingLead}
                >
                  {updatingLead ? <LoaderCircle className="animate-spin" /> : null}
                  Save note
                </Button>
              </div>
              {message ? (
                <p role="status" className="mt-3 rounded-lg bg-brand-soft p-2 text-[10px] font-bold text-brand-strong">
                  {message}
                </p>
              ) : null}
            </div>
            <div className="border-t p-4">
              <Button
                type="button"
                className="w-full"
                onClick={() => void advanceLead()}
                disabled={updatingLead}
              >
                Move to next stage
                <ArrowRight />
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
          aria-labelledby="new-lead-title"
        >
          <form onSubmit={createLead} className="my-6 w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand">
                  Quick create
                </p>
                <h2 id="new-lead-title" className="mt-1 font-extrabold">
                  Add a sales lead
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-2 hover:bg-surface-muted"
                aria-label="Close new lead form"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ["Customer name", "name", "text", true],
                ["Telephone", "phone", "tel", true],
                ["Email", "email", "email", true],
                ["Vehicle or subject", "subject", "text", true],
                ["Source", "source", "text", false],
              ].map(([label, name, type, required]) => (
                <label key={String(name)} className="text-xs font-extrabold">
                  {label}
                  <Input
                    name={String(name)}
                    type={String(type)}
                    required={Boolean(required)}
                    className="mt-1.5"
                  />
                </label>
              ))}
              <label className="text-xs font-extrabold">
                Enquiry type
                <select name="type" className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm">
                  <option value="vehicle_enquiry">Vehicle enquiry</option>
                  <option value="callback_request">Callback request</option>
                  <option value="test_drive">Test drive</option>
                  <option value="part_exchange">Part exchange</option>
                  <option value="general_enquiry">General enquiry</option>
                </select>
              </label>
              <label className="text-xs font-extrabold sm:col-span-2">
                Initial notes
                <Textarea name="notes" className="mt-1.5" />
              </label>
            </div>
            {message ? (
              <p role="status" className="mx-5 rounded-lg bg-surface-muted p-3 text-xs">
                {message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t p-4">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? <LoaderCircle className="animate-spin" /> : <UserRound />}
                Create lead
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
