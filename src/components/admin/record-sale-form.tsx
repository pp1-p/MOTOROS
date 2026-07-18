"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; label: string };

export function RecordSaleForm({
  vehicles,
  customers,
  salespeople,
}: {
  vehicles: Option[];
  customers: Option[];
  salespeople: Option[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const additionalProducts = String(form.get("additionalProducts") ?? "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    const completionChecklist = Object.fromEntries(
      ["identity", "payment", "documents", "handover"].map((item) => [
        item,
        form.get(`check-${item}`) === "on",
      ]),
    );
    const payload = {
      vehicleId: form.get("vehicleId"),
      customerId: form.get("customerId"),
      salespersonId: form.get("salespersonId") || undefined,
      salePrice: form.get("salePrice"),
      deposit: form.get("deposit") || 0,
      partExchangeAllowance: form.get("partExchangeAllowance") || 0,
      discount: form.get("discount") || 0,
      warranty: form.get("warranty") || null,
      additionalProducts,
      paymentMethod: form.get("paymentMethod"),
      saleDate: form.get("saleDate"),
      handoverDate: form.get("handoverDate") || null,
      internalNotes: form.get("internalNotes") || null,
      completionChecklist,
      confirm: true,
    };
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        sale?: { sale_id?: string };
      } | null;
      if (!response.ok || !result?.sale?.sale_id) {
        setMessage(result?.message ?? "The sale could not be recorded.");
        return;
      }
      router.push(`/admin/sales/${result.sale.sale_id}`);
      router.refresh();
    } catch {
      setMessage("DealerOS could not reach the server. No sale was recorded.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-white">
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <label className="text-xs font-extrabold">
          Vehicle
          <select
            name="vehicleId"
            required
            className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
          >
            <option value="">Choose vehicle</option>
            {vehicles.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-extrabold">
          Customer
          <select
            name="customerId"
            required
            className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
          >
            <option value="">Choose customer</option>
            {customers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-extrabold">
          Salesperson
          <select
            name="salespersonId"
            className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
          >
            <option value="">Current user</option>
            {salespeople.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-extrabold">
          Payment method
          <Input name="paymentMethod" required className="mt-1.5" />
        </label>
        <label className="text-xs font-extrabold">
          Sale price
          <Input name="salePrice" type="number" min={0} step="0.01" required className="mt-1.5" />
        </label>
        <label className="text-xs font-extrabold">
          Deposit
          <Input name="deposit" type="number" min={0} step="0.01" defaultValue={0} className="mt-1.5" />
        </label>
        <label className="text-xs font-extrabold">
          Part-exchange allowance
          <Input name="partExchangeAllowance" type="number" min={0} step="0.01" defaultValue={0} className="mt-1.5" />
        </label>
        <label className="text-xs font-extrabold">
          Discount
          <Input name="discount" type="number" min={0} step="0.01" defaultValue={0} className="mt-1.5" />
        </label>
        <label className="text-xs font-extrabold">
          Sale date
          <Input
            name="saleDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
            className="mt-1.5"
          />
        </label>
        <label className="text-xs font-extrabold">
          Handover date
          <Input name="handoverDate" type="date" className="mt-1.5" />
        </label>
        <label className="text-xs font-extrabold sm:col-span-2">
          Warranty
          <Input name="warranty" className="mt-1.5" />
        </label>
        <label className="text-xs font-extrabold sm:col-span-2">
          Additional products
          <Textarea
            name="additionalProducts"
            className="mt-1.5"
            placeholder="One item per line"
          />
        </label>
        <label className="text-xs font-extrabold sm:col-span-2">
          Internal notes
          <Textarea name="internalNotes" className="mt-1.5" />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-extrabold">Completion checklist</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["identity", "Customer identity checked"],
              ["payment", "Payment details confirmed"],
              ["documents", "Sale documents prepared"],
              ["handover", "Handover plan agreed"],
            ].map(([id, label]) => (
              <label key={id} className="flex items-center gap-2 text-xs font-semibold">
                <input name={`check-${id}`} type="checkbox" className="size-4 accent-brand" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {message ? (
        <p role="status" className="mx-5 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800">
          {message}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end border-t p-5">
        <Button type="submit" disabled={saving}>
          {saving ? <LoaderCircle className="animate-spin" /> : <ReceiptText />}
          Record completed sale
        </Button>
      </div>
    </form>
  );
}
