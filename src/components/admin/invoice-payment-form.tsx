"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoicePaymentMethod } from "@/lib/types/invoices";

const methods: InvoicePaymentMethod[] = [
  "card",
  "cash",
  "bank_transfer",
  "finance_provider",
  "cheque",
  "payment_link",
  "other",
];

const methodLabels: Record<InvoicePaymentMethod, string> = {
  card: "Card",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  finance_provider: "Finance provider",
  cheque: "Cheque",
  payment_link: "Payment link",
  deposit_transfer: "Deposit",
  other: "Other",
};

export function InvoicePaymentForm({
  invoiceId,
  balance,
  currency,
}: {
  invoiceId: string;
  balance: number;
  currency: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : "");
  const [method, setMethod] = useState<InvoicePaymentMethod>("card");
  const clientReference = useMemo(() => crypto.randomUUID(), [invoiceId]);

  const currencyLabel = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  })
    .formatToParts(0)[0]
    ?.value?.trim();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount,
          method,
          reference: String(data.get("reference") ?? "").trim() || undefined,
          notes: String(data.get("notes") ?? "").trim() || undefined,
          clientReference,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string; fieldErrors?: Record<string, string[] | undefined> }
        | null;
      if (!response.ok) {
        const bad = Object.entries(result?.fieldErrors ?? {}).find(
          ([, issues]) => (issues?.length ?? 0) > 0,
        );
        setMessage(
          bad
            ? `${bad[0]}: ${bad[1]?.[0] ?? "please review"}`
            : result?.message ?? "The payment could not be recorded.",
        );
        return;
      }
      setMessage("Payment recorded.");
      router.refresh();
      window.setTimeout(() => setMessage(""), 2500);
    } catch {
      setMessage("Could not reach the server. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] font-extrabold">
          Amount ({currencyLabel ?? currency})
          <Input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1.5"
          />
        </label>
        <label className="block text-[11px] font-extrabold">
          Method
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as InvoicePaymentMethod)}
            className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
          >
            {methods.map((option) => (
              <option key={option} value={option}>
                {methodLabels[option]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-[11px] font-extrabold">
        Reference (optional)
        <Input name="reference" placeholder="Transaction ID, cheque no." className="mt-1.5" />
      </label>
      <label className="block text-[11px] font-extrabold">
        Notes (optional)
        <Input name="notes" className="mt-1.5" />
      </label>
      {message ? (
        <p
          className={`text-xs font-semibold ${message.startsWith("Payment recorded") ? "text-emerald-700" : "text-red-700"}`}
        >
          {message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || balance <= 0}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {saving ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
