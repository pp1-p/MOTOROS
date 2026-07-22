"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { InvoicePaymentMethod } from "@/lib/types/invoices";

const refundMethods: InvoicePaymentMethod[] = [
  "card",
  "bank_transfer",
  "cash",
  "cheque",
  "payment_link",
  "finance_provider",
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

export function IssueCreditNoteForm({
  invoiceId,
  creditableRemaining,
  currency,
}: {
  invoiceId: string;
  creditableRemaining: number;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState(
    creditableRemaining > 0 ? creditableRemaining.toFixed(2) : "",
  );

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
      const response = await fetch(
        `/api/admin/invoices/${invoiceId}/credit-notes`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            amount,
            reason: String(data.get("reason") ?? "").trim(),
            notes: String(data.get("notes") ?? "").trim() || undefined,
          }),
        },
      );
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
            : result?.message ?? "The credit note could not be issued.",
        );
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setMessage("Could not reach the server. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={creditableRemaining <= 0}
      >
        Issue credit note
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4">
      <h3 className="text-xs font-extrabold">Issue credit note</h3>
      <label className="block text-[11px] font-extrabold">
        Amount ({currencyLabel ?? currency})
        <Input
          type="number"
          step="0.01"
          min="0.01"
          max={creditableRemaining}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="mt-1.5"
        />
        <span className="mt-1 block text-[10px] text-foreground/50">
          Up to {currencyLabel ?? ""}
          {creditableRemaining.toFixed(2)} may still be credited.
        </span>
      </label>
      <label className="block text-[11px] font-extrabold">
        Reason
        <Input
          name="reason"
          required
          minLength={2}
          maxLength={200}
          placeholder="e.g. Warranty repair reduced, discount agreed"
          className="mt-1.5"
        />
      </label>
      <label className="block text-[11px] font-extrabold">
        Notes (optional)
        <Textarea name="notes" className="mt-1.5" />
      </label>
      {message ? (
        <p className="text-xs font-semibold text-red-700">{message}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {saving ? "Issuing…" : "Issue credit note"}
        </Button>
      </div>
    </form>
  );
}

export function RefundCreditNoteButton({
  creditNoteId,
}: {
  creditNoteId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [method, setMethod] = useState<InvoicePaymentMethod>("bank_transfer");
  const clientReference = useMemo(() => crypto.randomUUID(), [creditNoteId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        `/api/admin/credit-notes/${creditNoteId}/refund`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            method,
            reference:
              String(data.get("reference") ?? "").trim() || undefined,
            notes: String(data.get("notes") ?? "").trim() || undefined,
            clientReference,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        setMessage(result?.message ?? "The refund could not be recorded.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setMessage("Could not reach the server. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Record refund
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border bg-white p-3">
      <label className="block text-[11px] font-extrabold">
        Method
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value as InvoicePaymentMethod)}
          className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-xs"
        >
          {refundMethods.map((option) => (
            <option key={option} value={option}>
              {methodLabels[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] font-extrabold">
        Reference
        <Input name="reference" className="mt-1.5" />
      </label>
      <label className="block text-[11px] font-extrabold">
        Notes
        <Input name="notes" className="mt-1.5" />
      </label>
      {message ? (
        <p className="text-xs font-semibold text-red-700">{message}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {saving ? "Recording…" : "Record refund"}
        </Button>
      </div>
    </form>
  );
}

export function VoidInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    const reason = window.prompt(
      "Void this invoice? Enter a short reason for the audit log:",
    );
    if (!reason || reason.trim().length < 2) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/void`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        setMessage(result?.message ?? "The invoice could not be voided.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Could not reach the server. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={submit}
        disabled={saving}
        className="text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Void invoice
      </Button>
      {message ? (
        <p className="text-xs font-semibold text-red-700">{message}</p>
      ) : null}
    </div>
  );
}
