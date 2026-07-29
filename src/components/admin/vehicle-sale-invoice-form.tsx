"use client";

import { LoaderCircle, Plus, Save, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  GeneralInvoiceCustomerOption,
  GeneralInvoiceVehicleOption,
} from "@/lib/data/admin-invoices";
import { cn } from "@/lib/utils";

type VehicleSnapshot = {
  registration: string;
  vin: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
};

type ExtraProduct = {
  key: string;
  name: string;
  quantity: string;
  price: string;
  vat_rate: string;
};

const emptyVehicle: VehicleSnapshot = {
  registration: "",
  vin: "",
  make: "",
  model: "",
  year: "",
  mileage: "",
};

const emptyProduct: () => ExtraProduct = () => ({
  key: crypto.randomUUID(),
  name: "",
  quantity: "1",
  price: "0",
  vat_rate: "20",
});

const paymentMethods = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "finance_provider", label: "Finance provider" },
  { value: "payment_link", label: "Payment link" },
  { value: "deposit_transfer", label: "Deposit transfer" },
  { value: "other", label: "Other" },
] as const;

const defaultWarrantyTerms =
  "3-month/3,000-mile mechanical warranty covering the engine, gearbox and drivetrain from the date of collection. Extended cover options available on request. Full terms provided at handover.";

export function VehicleSaleInvoiceForm({
  customers,
  vehicles,
}: {
  customers: GeneralInvoiceCustomerOption[];
  vehicles: GeneralInvoiceVehicleOption[];
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [vehicleMode, setVehicleMode] = useState<"linked" | "manual">(
    vehicles.length ? "linked" : "manual",
  );
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [vehicleSnapshot, setVehicleSnapshot] = useState<VehicleSnapshot>({
    ...emptyVehicle,
  });

  const [title, setTitle] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [depositPaid, setDepositPaid] = useState("");
  const [depositMethod, setDepositMethod] = useState<
    (typeof paymentMethods)[number]["value"]
  >("bank_transfer");
  const [warrantyPrice, setWarrantyPrice] = useState("");
  const [prepFee, setPrepFee] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [adminFee, setAdminFee] = useState("");
  const [extras, setExtras] = useState<ExtraProduct[]>([]);

  const [pxDescription, setPxDescription] = useState("");
  const [pxAllowance, setPxAllowance] = useState("");
  const [pxRegistration, setPxRegistration] = useState("");
  const [pxMileage, setPxMileage] = useState("");

  const [warrantyTerms, setWarrantyTerms] = useState(defaultWarrantyTerms);
  const [paymentMethodNote, setPaymentMethodNote] = useState("");
  const [vatTreatment, setVatTreatment] = useState<
    "standard" | "margin" | "zero" | "exempt" | "not_registered"
  >("margin");
  const [vatRate, setVatRate] = useState("20");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const price = Number(salePrice) || 0;
    const warranty = Number(warrantyPrice) || 0;
    const prep = Number(prepFee) || 0;
    const delivery = Number(deliveryFee) || 0;
    const admin = Number(adminFee) || 0;
    const extrasTotal = extras.reduce(
      (sum, entry) =>
        sum + (Number(entry.quantity) || 0) * (Number(entry.price) || 0),
      0,
    );
    const partExchange = Number(pxAllowance) || 0;
    const deposit = Number(depositPaid) || 0;
    const rate = ["zero", "exempt", "not_registered"].includes(vatTreatment)
      ? 0
      : Number(vatRate) || 0;

    // Under the used-margin scheme, VAT applies to the profit, not the sale
    // price shown to the customer. For the customer-facing balance we only
    // add VAT on top when the treatment is 'standard'.
    const vatable =
      vatTreatment === "standard" ? price + warranty + prep + delivery + admin + extrasTotal : 0;
    const vat = (vatable * rate) / 100;
    const gross =
      price + warranty + prep + delivery + admin + extrasTotal + vat;
    const afterPartExchange = gross - partExchange;
    const balance = Math.max(afterPartExchange - deposit, 0);
    return {
      subtotal: price + warranty + prep + delivery + admin + extrasTotal,
      vat,
      gross,
      partExchange,
      deposit,
      balance,
    };
  }, [
    salePrice,
    warrantyPrice,
    prepFee,
    deliveryFee,
    adminFee,
    extras,
    pxAllowance,
    depositPaid,
    vatTreatment,
    vatRate,
  ]);

  function addExtra() {
    setExtras((current) => [...current, emptyProduct()]);
  }

  function updateExtra(key: string, patch: Partial<ExtraProduct>) {
    setExtras((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)),
    );
  }

  function removeExtra(key: string) {
    setExtras((current) => current.filter((entry) => entry.key !== key));
  }

  async function submit(status: "draft" | "sent") {
    setError(null);
    if (!customerId) {
      setError("Choose a buyer first");
      return;
    }
    if (!salePrice || Number(salePrice) <= 0) {
      setError("Enter the sale price");
      return;
    }

    const payload = {
      title: title.trim() || undefined,
      status,
      customer_id: customerId,
      vehicle_id: vehicleMode === "linked" && vehicleId ? vehicleId : null,
      vehicle_snapshot: vehicleMode === "manual" ? vehicleSnapshot : undefined,
      due_at: dueAt ? new Date(`${dueAt}T17:00:00`).toISOString() : null,
      vat_treatment: vatTreatment,
      vat_rate: Number(vatRate) || 0,
      sale_price: Number(salePrice) || 0,
      deposit_paid: Number(depositPaid) || 0,
      deposit_method: Number(depositPaid) > 0 ? depositMethod : undefined,
      warranty_price: Number(warrantyPrice) || 0,
      delivery_fee: Number(deliveryFee) || 0,
      admin_fee: Number(adminFee) || 0,
      preparation_fee: Number(prepFee) || 0,
      part_exchange:
        Number(pxAllowance) > 0 || pxDescription.trim().length > 0
          ? {
              description: pxDescription.trim() || undefined,
              allowance: Number(pxAllowance) || 0,
              registration: pxRegistration.trim() || undefined,
              mileage: pxMileage.trim() || undefined,
            }
          : undefined,
      additional_products: extras
        .filter((entry) => entry.name.trim().length > 0)
        .map((entry) => ({
          name: entry.name.trim(),
          quantity: Number(entry.quantity) || 1,
          price: Number(entry.price) || 0,
          vat_rate: Number(entry.vat_rate) || 0,
        })),
      warranty_terms: warrantyTerms.trim() || null,
      payment_method_note: paymentMethodNote.trim() || null,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/admin/invoices/vehicle-sale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        id?: string;
      };
      if (!res.ok) {
        setError(body.message ?? "Could not save the sale invoice");
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
          : "Could not save the sale invoice",
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
            Buyer &amp; vehicle
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-extrabold">
              Buyer
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
                placeholder="e.g. 2018 Range Rover Sport sale"
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
                    ["mileage", "Mileage at sale", "48200"],
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
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
            Sale price &amp; fees
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MoneyField
              label="Sale price"
              value={salePrice}
              onChange={setSalePrice}
              placeholder="e.g. 16500"
              required
            />
            <MoneyField
              label="Extended warranty"
              value={warrantyPrice}
              onChange={setWarrantyPrice}
              placeholder="0"
            />
            <MoneyField
              label="Vehicle preparation"
              value={prepFee}
              onChange={setPrepFee}
              placeholder="0"
            />
            <MoneyField
              label="Delivery"
              value={deliveryFee}
              onChange={setDeliveryFee}
              placeholder="0"
            />
            <MoneyField
              label="Admin fee"
              value={adminFee}
              onChange={setAdminFee}
              placeholder="0"
            />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-foreground/60">
                Additional products
              </h3>
              <button
                type="button"
                onClick={addExtra}
                className="inline-flex items-center gap-1 text-xs font-extrabold text-brand hover:underline"
              >
                <Plus className="size-3.5" /> Add product
              </button>
            </div>
            {extras.length === 0 ? (
              <p className="mt-2 text-xs text-foreground/45">
                Optional line items — GAP insurance, paint protection, service
                plan, tank of fuel etc.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {extras.map((extra) => (
                  <div
                    key={extra.key}
                    className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_80px_100px_80px_36px]"
                  >
                    <Input
                      value={extra.name}
                      onChange={(event) =>
                        updateExtra(extra.key, { name: event.target.value })
                      }
                      placeholder="Product name"
                      className="h-10"
                    />
                    <Input
                      value={extra.quantity}
                      onChange={(event) =>
                        updateExtra(extra.key, { quantity: event.target.value })
                      }
                      type="number"
                      min={0}
                      className="h-10 text-right"
                      aria-label="Quantity"
                    />
                    <Input
                      value={extra.price}
                      onChange={(event) =>
                        updateExtra(extra.key, { price: event.target.value })
                      }
                      type="number"
                      step="0.01"
                      min={0}
                      className="h-10 text-right"
                      aria-label="Price"
                    />
                    <Input
                      value={extra.vat_rate}
                      onChange={(event) =>
                        updateExtra(extra.key, { vat_rate: event.target.value })
                      }
                      type="number"
                      step="0.5"
                      min={0}
                      max={100}
                      className="h-10 text-right"
                      aria-label="VAT rate"
                    />
                    <button
                      type="button"
                      onClick={() => removeExtra(extra.key)}
                      className="grid size-10 place-items-center rounded-lg text-foreground/45 hover:bg-red-50 hover:text-red-700"
                      aria-label="Remove product"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
            Part exchange
          </h2>
          <p className="mt-1 text-xs text-foreground/60">
            The customer&apos;s trade-in reduces the balance owed. Leave the
            allowance at 0 if there&apos;s no part-exchange.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-extrabold sm:col-span-2">
              Part-exchange description
              <Input
                value={pxDescription}
                onChange={(event) => setPxDescription(event.target.value)}
                placeholder="e.g. 2015 Ford Focus 1.0 EcoBoost"
                className="h-11"
              />
            </label>
            <label className="grid gap-1 text-xs font-extrabold">
              Registration
              <Input
                value={pxRegistration}
                onChange={(event) => setPxRegistration(event.target.value)}
                placeholder="e.g. FA15 XYZ"
                className="h-11 uppercase tracking-wide"
              />
            </label>
            <label className="grid gap-1 text-xs font-extrabold">
              Mileage
              <Input
                value={pxMileage}
                onChange={(event) => setPxMileage(event.target.value)}
                placeholder="e.g. 78000"
                type="number"
                min={0}
                className="h-11"
              />
            </label>
            <MoneyField
              label="Part-exchange allowance"
              value={pxAllowance}
              onChange={setPxAllowance}
              placeholder="0"
            />
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
            Deposit &amp; payment method
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MoneyField
              label="Deposit already paid"
              value={depositPaid}
              onChange={setDepositPaid}
              placeholder="0"
            />
            <label className="grid gap-1 text-xs font-extrabold">
              Deposit method
              <select
                value={depositMethod}
                onChange={(event) =>
                  setDepositMethod(
                    event.target.value as typeof depositMethod,
                  )
                }
                className="h-11 rounded-xl border bg-white px-3 text-sm"
                disabled={!depositPaid || Number(depositPaid) <= 0}
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-extrabold sm:col-span-2">
              Balance payment method / notes
              <Input
                value={paymentMethodNote}
                onChange={(event) => setPaymentMethodNote(event.target.value)}
                placeholder="e.g. Balance by bank transfer on collection · Autobahn Finance approved"
                className="h-11"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
            Warranty terms &amp; notes
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-xs font-extrabold">
              Warranty terms
              <Textarea
                value={warrantyTerms}
                onChange={(event) => setWarrantyTerms(event.target.value)}
                className="min-h-28"
                placeholder="Cover, duration and any exclusions."
              />
            </label>
            <label className="grid gap-1 text-xs font-extrabold">
              Customer notes
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-28"
                placeholder="Anything the customer needs to see below the totals."
              />
            </label>
            <label className="grid gap-1 text-xs font-extrabold lg:col-span-2">
              Terms &amp; conditions
              <Textarea
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                className="min-h-28"
                placeholder="e.g. Vehicle sold subject to our full terms of sale — available on request."
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
            <TotalsRow label="Sale + fees" value={totals.subtotal} />
            <TotalsRow label="VAT" value={totals.vat} />
            <TotalsRow label="Gross" value={totals.gross} bold />
            {totals.partExchange > 0 ? (
              <TotalsRow
                label="Part-exchange"
                value={-totals.partExchange}
                tone="text-emerald-700"
              />
            ) : null}
            {totals.deposit > 0 ? (
              <TotalsRow
                label="Deposit paid"
                value={-totals.deposit}
                tone="text-emerald-700"
              />
            ) : null}
            <div className="mt-2 flex items-center justify-between border-t pt-3 text-base font-extrabold">
              <dt>Balance due</dt>
              <dd className="tabular-nums">£{totals.balance.toFixed(2)}</dd>
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
                <option value="margin">Used-margin scheme</option>
                <option value="standard">Standard (VAT on top)</option>
                <option value="zero">Zero-rated</option>
                <option value="exempt">Exempt</option>
                <option value="not_registered">Not VAT registered</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-extrabold">
              VAT rate on fees (%)
              <Input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={vatRate}
                onChange={(event) => setVatRate(event.target.value)}
                className="h-10"
                disabled={["zero", "exempt", "not_registered"].includes(vatTreatment)}
              />
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

function MoneyField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-extrabold">
      {label}
      {required ? <span className="text-brand"> *</span> : null}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-foreground/45">
          £
        </span>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type="number"
          step="0.01"
          min={0}
          placeholder={placeholder}
          className="h-11 pl-7 text-right tabular-nums"
        />
      </div>
    </label>
  );
}

function TotalsRow({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: number;
  tone?: string;
  bold?: boolean;
}) {
  const formatted =
    value < 0
      ? `−£${Math.abs(value).toFixed(2)}`
      : `£${value.toFixed(2)}`;
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        tone,
        bold && "font-extrabold",
      )}
    >
      <dt className={cn(!tone && "text-foreground/55")}>{label}</dt>
      <dd className={cn("tabular-nums", bold && "font-extrabold")}>{formatted}</dd>
    </div>
  );
}
