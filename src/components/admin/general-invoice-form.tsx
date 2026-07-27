"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CarFront,
  FileText,
  LoaderCircle,
  Plus,
  ReceiptText,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type {
  GeneralInvoiceCustomerOption,
  GeneralInvoiceVehicleOption,
} from "@/lib/data/admin-invoices";
import type {
  InvoiceLineItemType,
  InvoiceVatTreatment,
} from "@/lib/types/invoices";

type EditableLine = {
  key: string;
  itemType: InvoiceLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

export type GeneralInvoiceFormInitial = {
  id: string;
  title: string;
  status: "draft" | "sent";
  customerId: string;
  vehicleId: string;
  issuedDate: string;
  dueDate: string;
  vatTreatment: InvoiceVatTreatment;
  showVat: boolean;
  showPaymentDetails: boolean;
  notes: string;
  terms: string;
  lines: EditableLine[];
};

function blankLine(index = 0): EditableLine {
  return {
    key: `invoice-line-${Date.now()}-${index}`,
    itemType: "charge",
    description: "",
    quantity: 1,
    unitPrice: 0,
    vatRate: 20,
  };
}

function dateToIso(value: string, endOfDay = false) {
  if (!value) return null;
  return new Date(
    `${value}T${endOfDay ? "23:59:59" : "12:00:00"}.000Z`,
  ).toISOString();
}

export function GeneralInvoiceForm({
  customers,
  vehicles,
  initial,
  initialVehicleId,
}: {
  customers: GeneralInvoiceCustomerOption[];
  vehicles: GeneralInvoiceVehicleOption[];
  initial?: GeneralInvoiceFormInitial;
  initialVehicleId?: string;
}) {
  const router = useRouter();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDefault] = useState(() => {
    const due = new Date();
    due.setDate(due.getDate() + 14);
    return due.toISOString().slice(0, 10);
  });
  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState<"draft" | "sent">(
    initial?.status ?? "draft",
  );
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [vehicleId, setVehicleId] = useState(
    initial?.vehicleId ?? initialVehicleId ?? "",
  );
  const [issuedDate, setIssuedDate] = useState(initial?.issuedDate ?? today);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? dueDefault);
  const [vatTreatment, setVatTreatment] = useState<InvoiceVatTreatment>(
    initial?.vatTreatment ?? "standard",
  );
  const [showVat, setShowVat] = useState(initial?.showVat ?? true);
  const [showPaymentDetails, setShowPaymentDetails] = useState(
    initial?.showPaymentDetails ?? true,
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [lines, setLines] = useState<EditableLine[]>(() =>
    initial?.lines.length ? initial.lines : [blankLine()],
  );
  const [saving, setSaving] = useState(false);

  const effectiveVat =
    showVat && !["zero", "exempt", "not_registered"].includes(vatTreatment);
  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let vat = 0;
    for (const line of lines) {
      const net = Math.max(Number(line.quantity) || 0, 0) *
        Math.max(Number(line.unitPrice) || 0, 0);
      if (line.itemType === "discount") {
        discount += net;
      } else {
        subtotal += net;
        vat += effectiveVat ? net * (Math.max(Number(line.vatRate) || 0, 0) / 100) : 0;
      }
    }
    return {
      subtotal: Math.max(subtotal, 0),
      discount: Math.max(discount, 0),
      vat: Math.max(vat, 0),
      total: Math.max(subtotal - discount + vat, 0),
    };
  }, [effectiveVat, lines]);

  function updateLine(key: string, patch: Partial<EditableLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(key: string) {
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.key !== key),
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedLines = lines.filter((line) => line.description.trim());
    if (!customerId) {
      toast.error("Choose a customer for this invoice.");
      return;
    }
    if (!cleanedLines.length) {
      toast.error("Add at least one invoice item.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(initial ? {} : { source: "general", type: "general" }),
        title,
        status,
        customer_id: customerId,
        vehicle_id: vehicleId || null,
        issued_at: status === "sent" ? dateToIso(issuedDate) : null,
        due_at: dateToIso(dueDate, true),
        vat_treatment: vatTreatment,
        show_vat: showVat,
        show_payment_details: showPaymentDetails,
        notes: notes || null,
        terms: terms || null,
        line_items: cleanedLines.map((line) => ({
          item_type: line.itemType,
          description: line.description,
          quantity: Number(line.quantity),
          unit_price: Number(line.unitPrice),
          vat_rate: effectiveVat ? Number(line.vatRate) : 0,
        })),
      };
      const response = await fetch(
        initial ? `/api/admin/invoices/${initial.id}` : "/api/admin/invoices",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; invoiceId?: string; message?: string }
        | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message ?? "The invoice could not be saved.");
      }
      toast.success(initial ? "Invoice updated." : "Invoice created.");
      router.push(`/admin/invoices/${result.invoiceId ?? initial?.id}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The invoice could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
              <ReceiptText className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-extrabold">Invoice details</h2>
              <p className="text-xs text-foreground/48">
                Create a standalone invoice and optionally link it to a stock vehicle.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Title / reference" className="sm:col-span-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={160}
                placeholder="e.g. Major service and preparation"
                className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
              />
            </Field>
            <Field label="Customer">
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                required
                className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
              >
                <option value="">Choose customer…</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.email ? ` · ${customer.email}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vehicle (optional)">
              <select
                value={vehicleId}
                onChange={(event) => setVehicleId(event.target.value)}
                className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
              >
                <option value="">No linked vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration} · {vehicle.description}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Invoice date">
              <input
                type="date"
                value={issuedDate}
                onChange={(event) => setIssuedDate(event.target.value)}
                className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
              />
            </Field>
            <Field label="Payment due">
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
              />
            </Field>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div>
              <h2 className="font-extrabold">Items</h2>
              <p className="mt-1 text-xs text-foreground/48">
                Add labour, parts, fees or discounts as separate rows.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLines((current) => [...current, blankLine(current.length)])}
            >
              <Plus />
              Add row
            </Button>
          </div>
          <div className="divide-y">
            {lines.map((line, index) => (
              <div key={line.key} className="grid gap-3 p-4 lg:grid-cols-[120px_minmax(200px,1fr)_90px_130px_100px_42px]">
                <Field label={index === 0 ? "Type" : ""}>
                  <select
                    value={line.itemType}
                    onChange={(event) =>
                      updateLine(line.key, {
                        itemType: event.target.value as InvoiceLineItemType,
                      })
                    }
                    className="h-10 w-full rounded-xl border bg-white px-2 text-xs"
                  >
                    <option value="charge">Charge</option>
                    <option value="labour">Labour</option>
                    <option value="part">Part</option>
                    <option value="fee">Fee</option>
                    <option value="discount">Discount</option>
                  </select>
                </Field>
                <Field label={index === 0 ? "Description" : ""}>
                  <input
                    value={line.description}
                    onChange={(event) =>
                      updateLine(line.key, { description: event.target.value })
                    }
                    placeholder="Work, product or adjustment"
                    className="h-10 w-full rounded-xl border bg-white px-3 text-xs"
                  />
                </Field>
                <Field label={index === 0 ? "Qty" : ""}>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(line.key, { quantity: Number(event.target.value) })
                    }
                    className="h-10 w-full rounded-xl border bg-white px-2 text-xs"
                  />
                </Field>
                <Field label={index === 0 ? "Unit price" : ""}>
                  <div className="flex h-10 overflow-hidden rounded-xl border">
                    <span className="grid w-9 place-items-center bg-[#fafaf8] text-xs font-bold text-foreground/45">
                      £
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(event) =>
                        updateLine(line.key, { unitPrice: Number(event.target.value) })
                      }
                      className="min-w-0 flex-1 bg-white px-2 text-xs"
                    />
                  </div>
                </Field>
                <Field label={index === 0 ? "VAT" : ""}>
                  <select
                    value={effectiveVat ? line.vatRate : 0}
                    disabled={!effectiveVat}
                    onChange={(event) =>
                      updateLine(line.key, { vatRate: Number(event.target.value) })
                    }
                    className="h-10 w-full rounded-xl border bg-white px-2 text-xs disabled:bg-foreground/5"
                  >
                    <option value={20}>20%</option>
                    <option value={5}>5%</option>
                    <option value={0}>0%</option>
                  </select>
                </Field>
                <div className={index === 0 ? "pt-[22px]" : ""}>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    className="grid size-10 place-items-center rounded-xl text-foreground/35 hover:bg-red-50 hover:text-red-700 disabled:opacity-25"
                    aria-label="Remove invoice item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Additional information">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Information shown with the invoice"
                className="w-full rounded-xl border bg-white p-3 text-sm"
              />
            </Field>
            <Field label="Terms">
              <textarea
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Payment terms or warranty wording"
                className="w-full rounded-xl border bg-white p-3 text-sm"
              />
            </Field>
          </div>
        </section>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-brand" />
            <h2 className="text-sm font-extrabold">Invoice settings</h2>
          </div>
          <div className="mt-5 space-y-4">
            <Field label="Save as">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as "draft" | "sent")}
                className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="sent">Issued</option>
              </select>
            </Field>
            <Field label="VAT treatment">
              <select
                value={vatTreatment}
                onChange={(event) =>
                  setVatTreatment(event.target.value as InvoiceVatTreatment)
                }
                className="h-11 w-full rounded-xl border bg-white px-3 text-sm"
              >
                <option value="standard">Standard VAT</option>
                <option value="zero">Zero rated</option>
                <option value="exempt">VAT exempt</option>
                <option value="not_registered">Not VAT registered</option>
              </select>
            </Field>
            <Toggle
              checked={showVat}
              onChange={setShowVat}
              icon={ReceiptText}
              title="Show VAT"
              description="Display VAT amounts on the invoice."
            />
            <Toggle
              checked={showPaymentDetails}
              onChange={setShowPaymentDetails}
              icon={UserRound}
              title="Payment details"
              description="Include the payment-reference note."
            />
          </div>
        </section>

        <section className="rounded-2xl border bg-[#10231f] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/45">
            Invoice total
          </p>
          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-white/55">Net</dt>
              <dd className="font-bold">£{totals.subtotal.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/55">VAT</dt>
              <dd className="font-bold">£{totals.vat.toFixed(2)}</dd>
            </div>
            {totals.discount > 0 ? (
              <div className="flex justify-between text-emerald-200">
                <dt>Discounts</dt>
                <dd className="font-bold">−£{totals.discount.toFixed(2)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-white/15 pt-3">
              <dt className="font-extrabold">Total</dt>
              <dd className="text-xl font-extrabold text-[#d6a852]">
                £{totals.total.toFixed(2)}
              </dd>
            </div>
          </dl>
          <Button
            type="submit"
            className="mt-5 w-full bg-[#d6a852] text-[#10231f] hover:bg-[#e4bd72]"
            disabled={saving || customers.length === 0}
          >
            {saving ? <LoaderCircle className="animate-spin" /> : <FileText />}
            {saving
              ? "Saving…"
              : initial
                ? "Update invoice"
                : status === "sent"
                  ? "Create and issue"
                  : "Save draft"}
          </Button>
          {customers.length === 0 ? (
            <p className="mt-3 text-center text-[10px] text-white/50">
              Add a customer before creating an invoice.
            </p>
          ) : null}
        </section>

        <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-foreground/45">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> Due date tracked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CarFront className="size-3.5" /> Vehicle link
          </span>
        </div>
      </aside>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label ? (
        <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">
          {label}
        </span>
      ) : null}
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  icon: Icon,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: typeof ReceiptText;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-[#9b742f]"
      />
      <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
      <span>
        <span className="block text-xs font-extrabold">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-foreground/45">
          {description}
        </span>
      </span>
    </label>
  );
}
