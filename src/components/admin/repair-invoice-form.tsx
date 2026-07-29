"use client";

import {
  LoaderCircle,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  GeneralInvoiceCustomerOption,
  GeneralInvoiceVehicleOption,
} from "@/lib/data/admin-invoices";
import type { RepairCode } from "@/lib/data/admin-repair-codes";
import { cn } from "@/lib/utils";

type LineItemType = "labour" | "part" | "charge" | "fee" | "discount" | "note";

type LineDraft = {
  key: string;
  item_type: LineItemType;
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
  repair_code_id: string | null;
};

type VehicleSnapshot = {
  registration: string;
  vin: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
};

const emptyLine: () => LineDraft = () => ({
  key: crypto.randomUUID(),
  item_type: "labour",
  description: "",
  quantity: "1",
  unit_price: "0",
  vat_rate: "20",
  repair_code_id: null,
});

const emptyVehicle: VehicleSnapshot = {
  registration: "",
  vin: "",
  make: "",
  model: "",
  year: "",
  mileage: "",
};

const lineTypeLabels: Record<LineItemType, string> = {
  labour: "Labour",
  part: "Part",
  charge: "Diagnostic",
  fee: "Fee",
  discount: "Discount",
  note: "Note",
};

const lineTypeTones: Record<LineItemType, string> = {
  labour: "bg-blue-50 text-blue-700",
  part: "bg-amber-50 text-amber-700",
  charge: "bg-violet-50 text-violet-700",
  fee: "bg-slate-100 text-slate-700",
  discount: "bg-emerald-50 text-emerald-700",
  note: "bg-neutral-100 text-neutral-600",
};

function categoryToLineType(category: RepairCode["category"]): LineItemType {
  switch (category) {
    case "labour":
      return "labour";
    case "parts":
    case "consumable":
      return "part";
    case "diagnostic":
      return "charge";
    default:
      return "fee";
  }
}

export function RepairInvoiceForm({
  customers,
  vehicles,
  repairCodes,
}: {
  customers: GeneralInvoiceCustomerOption[];
  vehicles: GeneralInvoiceVehicleOption[];
  repairCodes: RepairCode[];
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id ?? "");
  const [vehicleMode, setVehicleMode] = useState<"linked" | "manual">(
    vehicles.length ? "linked" : "manual",
  );
  const [vehicleId, setVehicleId] = useState<string>(vehicles[0]?.id ?? "");
  const [vehicleSnapshot, setVehicleSnapshot] = useState<VehicleSnapshot>({
    ...emptyVehicle,
  });
  const [title, setTitle] = useState("");
  const [vatTreatment, setVatTreatment] = useState<
    "standard" | "margin" | "zero" | "exempt" | "not_registered"
  >("standard");
  const [showVat, setShowVat] = useState(true);
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [reportedFault, setReportedFault] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [workCompleted, setWorkCompleted] = useState("");
  const [technicianNotes, setTechnicianNotes] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [warranty, setWarranty] = useState(
    "Parts fitted are covered for 3 months / 3,000 miles from the date of this invoice. Labour is guaranteed for 30 days on the work described above.",
  );
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [codeSearch, setCodeSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeMatches = useMemo(() => {
    const term = codeSearch.trim().toLowerCase();
    if (!term) return [];
    return repairCodes
      .filter(
        (code) =>
          code.code.toLowerCase().includes(term) ||
          code.description.toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [codeSearch, repairCodes]);

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLineFromCode(code: RepairCode) {
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        item_type: categoryToLineType(code.category),
        description: `${code.code} · ${code.description}`,
        quantity: code.category === "labour" && code.labourHours > 0
          ? String(code.labourHours)
          : "1",
        unit_price: String(code.defaultPrice),
        vat_rate: String(code.taxRate),
        repair_code_id: code.id,
      },
    ]);
    setCodeSearch("");
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let vat = 0;
    for (const line of lines) {
      const qty = Number(line.quantity) || 0;
      const unit = Number(line.unit_price) || 0;
      const rate = Number(line.vat_rate) || 0;
      if (line.item_type === "note") continue;
      const net = qty * unit;
      if (line.item_type === "discount") {
        discount += Math.abs(net);
        continue;
      }
      subtotal += net;
      if (showVat && !["zero", "exempt", "not_registered"].includes(vatTreatment)) {
        vat += (net * rate) / 100;
      }
    }
    const total = Math.max(subtotal - discount + vat, 0);
    return { subtotal, discount, vat, total };
  }, [lines, showVat, vatTreatment]);

  async function submit(status: "draft" | "sent") {
    setError(null);
    if (!customerId) {
      setError("Choose a customer first");
      return;
    }
    const activeLines = lines
      .filter(
        (line) =>
          line.description.trim().length > 0 ||
          (line.item_type !== "note" && Number(line.unit_price) > 0),
      )
      .map((line) => ({
        item_type: line.item_type,
        description: line.description.trim() || lineTypeLabels[line.item_type],
        quantity: Number(line.quantity) || 1,
        unit_price: Number(line.unit_price) || 0,
        vat_rate: Number(line.vat_rate) || 0,
        repair_code_id: line.repair_code_id ?? undefined,
      }));
    if (activeLines.length === 0) {
      setError("Add at least one repair line");
      return;
    }

    const payload = {
      title: title.trim() || undefined,
      status,
      customer_id: customerId,
      vehicle_id: vehicleMode === "linked" && vehicleId ? vehicleId : null,
      vehicle_snapshot: vehicleMode === "manual" ? vehicleSnapshot : undefined,
      due_at: dueAt
        ? new Date(`${dueAt}T17:00:00`).toISOString()
        : null,
      vat_treatment: vatTreatment,
      show_vat: showVat,
      show_payment_details: true,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      reported_fault: reportedFault.trim() || null,
      diagnosis: diagnosis.trim() || null,
      work_completed: workCompleted.trim() || null,
      technician_notes: technicianNotes.trim() || null,
      recommendations: recommendations.trim() || null,
      warranty: warranty.trim() || null,
      line_items: activeLines,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/admin/invoices/repair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        id?: string;
      };
      if (!res.ok) {
        setError(body.message ?? "Could not save the repair invoice");
        return;
      }
      if (body.id) {
        router.push(`/admin/invoices/${body.id}`);
        return;
      }
      router.push("/admin/invoices");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save the repair invoice",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
            Customer &amp; vehicle
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-extrabold">
              Customer
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="h-11 rounded-xl border bg-white px-3 text-sm"
              >
                {customers.length === 0 ? (
                  <option value="">No customers yet</option>
                ) : null}
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.email ? ` · ${customer.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-extrabold">
              Invoice title{" "}
              <span className="font-semibold text-foreground/45">(optional)</span>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Front brake overhaul"
                className="h-11"
              />
            </label>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-3 text-xs font-extrabold">
              <span>Vehicle</span>
              <div className="inline-flex rounded-lg border bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setVehicleMode("linked")}
                  disabled={vehicles.length === 0}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-extrabold transition",
                    vehicleMode === "linked"
                      ? "bg-brand text-white"
                      : "text-foreground/60 hover:text-foreground",
                    vehicles.length === 0 && "opacity-50",
                  )}
                >
                  From stock
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleMode("manual")}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-extrabold transition",
                    vehicleMode === "manual"
                      ? "bg-brand text-white"
                      : "text-foreground/60 hover:text-foreground",
                  )}
                >
                  Enter manually
                </button>
              </div>
            </div>

            {vehicleMode === "linked" ? (
              <label className="mt-3 grid gap-1 text-xs font-extrabold">
                Stock vehicle
                <select
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  className="h-11 rounded-xl border bg-white px-3 text-sm"
                >
                  <option value="">No linked vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration} · {vehicle.description}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["registration", "Registration", "e.g. AB12 CDE"],
                    ["vin", "VIN", "17-character VIN"],
                    ["make", "Make", "Land Rover"],
                    ["model", "Model", "Range Rover Sport"],
                    ["year", "Year", "2018"],
                    ["mileage", "Mileage at service", "48200"],
                  ] as [keyof VehicleSnapshot, string, string][]
                ).map(([field, label, placeholder]) => (
                  <label key={field} className="grid gap-1 text-xs font-extrabold">
                    {label}
                    <Input
                      value={vehicleSnapshot[field]}
                      onChange={(event) =>
                        setVehicleSnapshot({
                          ...vehicleSnapshot,
                          [field]: event.target.value,
                        })
                      }
                      placeholder={placeholder}
                      className={cn(
                        "h-11",
                        field === "registration" && "uppercase tracking-wide",
                      )}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
              Repair lines
            </h2>
            <span className="text-[10px] font-extrabold text-foreground/45">
              {lines.length} {lines.length === 1 ? "line" : "lines"}
            </span>
          </div>
          <p className="mt-1 text-xs text-foreground/60">
            Type a repair code or a keyword to pull in a saved job, or fill in a
            row from scratch. Labour, parts, diagnostics and additional charges
            each have their own tag so the customer can see what they&apos;re
            paying for.
          </p>

          <div className="relative mt-4">
            <Input
              value={codeSearch}
              onChange={(event) => setCodeSearch(event.target.value)}
              placeholder="Search repair codes (e.g. LAB-BRK-01 or 'brake pads')"
              className="h-11"
            />
            {codeMatches.length > 0 ? (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
                {codeMatches.map((code) => (
                  <button
                    key={code.id}
                    type="button"
                    onClick={() => addLineFromCode(code)}
                    className="flex w-full items-start gap-3 border-b p-3 text-left last:border-0 hover:bg-surface-muted"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
                        lineTypeTones[categoryToLineType(code.category)],
                      )}
                    >
                      {code.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-extrabold">
                        {code.description}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-foreground/50">
                        £{code.defaultPrice.toFixed(2)} ·{" "}
                        {code.labourHours > 0 ? `${code.labourHours}h · ` : ""}
                        {code.taxRate.toFixed(0)}% VAT
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {lines.map((line) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-[110px_1fr_80px_100px_80px_36px]"
              >
                <select
                  value={line.item_type}
                  onChange={(event) =>
                    updateLine(line.key, {
                      item_type: event.target.value as LineItemType,
                    })
                  }
                  className="h-10 rounded-lg border bg-white px-2 text-xs font-extrabold"
                >
                  {(
                    ["labour", "part", "charge", "fee", "discount", "note"] as LineItemType[]
                  ).map((type) => (
                    <option key={type} value={type}>
                      {lineTypeLabels[type]}
                    </option>
                  ))}
                </select>
                <Input
                  value={line.description}
                  onChange={(event) =>
                    updateLine(line.key, { description: event.target.value })
                  }
                  placeholder="Describe the work / part"
                  className="h-10"
                />
                <Input
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(line.key, { quantity: event.target.value })
                  }
                  type="number"
                  step="0.25"
                  min={0}
                  className="h-10 text-right"
                  aria-label="Quantity or hours"
                  disabled={line.item_type === "note"}
                />
                <Input
                  value={line.unit_price}
                  onChange={(event) =>
                    updateLine(line.key, { unit_price: event.target.value })
                  }
                  type="number"
                  step="0.01"
                  min={0}
                  className="h-10 text-right"
                  aria-label="Unit price"
                  disabled={line.item_type === "note"}
                />
                <Input
                  value={line.vat_rate}
                  onChange={(event) =>
                    updateLine(line.key, { vat_rate: event.target.value })
                  }
                  type="number"
                  step="0.5"
                  min={0}
                  max={100}
                  className="h-10 text-right"
                  aria-label="VAT rate percent"
                  disabled={
                    line.item_type === "note" ||
                    line.item_type === "discount" ||
                    !showVat
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setLines((current) =>
                      current.length === 1
                        ? [emptyLine()]
                        : current.filter((entry) => entry.key !== line.key),
                    )
                  }
                  className="grid size-10 place-items-center rounded-lg text-foreground/45 hover:bg-red-50 hover:text-red-700"
                  aria-label="Remove line"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setLines((current) => [...current, emptyLine()])
              }
              className="inline-flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-extrabold text-foreground/60 hover:border-brand hover:text-brand"
            >
              <Plus className="size-4" />
              Add line
            </button>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
            Workshop narrative
          </h2>
          <p className="mt-1 text-xs text-foreground/60">
            The customer-facing story of the job. Anything in here prints on the
            invoice so they know exactly what was reported, done and
            recommended.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {(
              [
                ["reportedFault", "Reported fault", "What the customer described.", reportedFault, setReportedFault],
                ["diagnosis", "Diagnosis", "What we found on inspection.", diagnosis, setDiagnosis],
                ["workCompleted", "Work completed", "The jobs we carried out.", workCompleted, setWorkCompleted],
                ["technicianNotes", "Technician notes", "Internal notes for the record.", technicianNotes, setTechnicianNotes],
                ["recommendations", "Recommendations", "Advisories the customer should plan for.", recommendations, setRecommendations],
                ["warranty", "Warranty", "Parts & labour guarantee wording.", warranty, setWarranty],
              ] as [string, string, string, string, (value: string) => void][]
            ).map(([key, label, helper, value, setter]) => (
              <label key={key} className="grid gap-1 text-xs font-extrabold">
                {label}
                <Textarea
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                  className="min-h-24"
                  placeholder={helper}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
            Notes &amp; terms
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-xs font-extrabold">
              Customer notes
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything the customer needs to see below the totals."
                className="min-h-24"
              />
            </label>
            <label className="grid gap-1 text-xs font-extrabold">
              Payment terms
              <Textarea
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                placeholder="e.g. Payment due on collection. Bank details on file."
                className="min-h-24"
              />
            </label>
          </div>
        </section>
      </div>

      <aside className="space-y-4 self-start lg:sticky lg:top-4">
        <div className="rounded-2xl border bg-white p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
            Totals
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-foreground/55">Subtotal</dt>
              <dd className="font-bold tabular-nums">
                £{totals.subtotal.toFixed(2)}
              </dd>
            </div>
            {totals.discount > 0 ? (
              <div className="flex items-center justify-between text-emerald-700">
                <dt>Discount</dt>
                <dd className="font-bold tabular-nums">
                  −£{totals.discount.toFixed(2)}
                </dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <dt className="text-foreground/55">VAT</dt>
              <dd className="font-bold tabular-nums">
                £{totals.vat.toFixed(2)}
              </dd>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-3 text-base font-extrabold">
              <dt>Total due</dt>
              <dd className="tabular-nums">£{totals.total.toFixed(2)}</dd>
            </div>
          </dl>

          <div className="mt-5 space-y-3 border-t pt-4">
            <label className="grid gap-1 text-xs font-extrabold">
              VAT treatment
              <select
                value={vatTreatment}
                onChange={(event) =>
                  setVatTreatment(event.target.value as typeof vatTreatment)
                }
                className="h-10 rounded-lg border bg-white px-2 text-xs font-extrabold"
              >
                <option value="standard">Standard (20%)</option>
                <option value="margin">Margin scheme</option>
                <option value="zero">Zero-rated</option>
                <option value="exempt">Exempt</option>
                <option value="not_registered">Not VAT registered</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-extrabold">
              <input
                type="checkbox"
                checked={showVat}
                onChange={(event) => setShowVat(event.target.checked)}
                className="size-4 accent-brand"
              />
              Show VAT breakdown on the invoice
            </label>
            <label className="grid gap-1 text-xs font-extrabold">
              Payment due
              <Input
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="h-10"
              />
            </label>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={() => void submit("sent")}
            disabled={saving}
            className="w-full"
          >
            {saving ? <LoaderCircle className="animate-spin" /> : <Send />}
            Issue invoice
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void submit("draft")}
            disabled={saving}
            className="w-full"
          >
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            Save as draft
          </Button>
        </div>
      </aside>
    </div>
  );
}
