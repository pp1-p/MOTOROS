"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Values = {
  warranty_terms: string;
  payment_method_note: string;
  part_exchange_description: string;
  part_exchange_allowance: string;
  part_exchange_registration: string;
  part_exchange_mileage: string;
  notes: string;
  terms: string;
};

export function SaleDetailsEditForm({
  invoiceId,
  initial,
}: {
  invoiceId: string;
  initial: Values;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [saving, setSaving] = useState(false);

  function updateField<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const hasPartExchange =
        values.part_exchange_description.trim().length > 0 ||
        values.part_exchange_registration.trim().length > 0 ||
        values.part_exchange_mileage.trim().length > 0 ||
        (values.part_exchange_allowance.trim().length > 0 &&
          Number(values.part_exchange_allowance) > 0);
      const payload = {
        warranty_terms: values.warranty_terms.trim() || null,
        payment_method_note: values.payment_method_note.trim() || null,
        part_exchange: hasPartExchange
          ? {
              description: values.part_exchange_description.trim() || null,
              allowance: values.part_exchange_allowance.trim() || undefined,
              registration: values.part_exchange_registration.trim() || null,
              mileage: values.part_exchange_mileage.trim() || null,
            }
          : undefined,
        notes: values.notes.trim() || null,
        terms: values.terms.trim() || null,
      };
      const res = await fetch(
        `/api/admin/invoices/${invoiceId}/sale-details`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(body.message ?? "Could not save the sale details");
      }
      toast.success("Sale details updated.");
      router.push(`/admin/invoices/${invoiceId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
          Warranty &amp; payment
        </h2>
        <p className="mt-1 text-xs text-foreground/60">
          Edit sale-specific narrative fields. Sale price, deposit, VAT and
          line items are locked from this form — use{" "}
          <span className="font-extrabold">Duplicate</span> for a full re-issue.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-xs font-extrabold">
            Warranty terms
            <Textarea
              value={values.warranty_terms}
              onChange={(event) =>
                updateField("warranty_terms", event.target.value)
              }
              className="min-h-28"
              placeholder="Cover, duration and any exclusions."
            />
          </label>
          <label className="grid gap-1 text-xs font-extrabold">
            Payment method / notes
            <Textarea
              value={values.payment_method_note}
              onChange={(event) =>
                updateField("payment_method_note", event.target.value)
              }
              className="min-h-28"
              placeholder="e.g. Balance by bank transfer on collection · Autobahn Finance approved"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
          Part exchange
        </h2>
        <p className="mt-1 text-xs text-foreground/60">
          Editing here updates the sale narrative only. Changing the
          part-exchange <em>allowance</em> here does <strong>not</strong>{" "}
          recalculate the invoice total — for that you'll need to duplicate
          and re-issue.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-extrabold sm:col-span-2">
            Description
            <Input
              value={values.part_exchange_description}
              onChange={(event) =>
                updateField("part_exchange_description", event.target.value)
              }
              placeholder="e.g. 2015 Ford Focus 1.0 EcoBoost"
              className="h-11"
            />
          </label>
          <label className="grid gap-1 text-xs font-extrabold">
            Registration
            <Input
              value={values.part_exchange_registration}
              onChange={(event) =>
                updateField(
                  "part_exchange_registration",
                  event.target.value,
                )
              }
              placeholder="e.g. FA15 XYZ"
              className={cn("h-11 uppercase tracking-wide")}
            />
          </label>
          <label className="grid gap-1 text-xs font-extrabold">
            Mileage
            <Input
              value={values.part_exchange_mileage}
              onChange={(event) =>
                updateField("part_exchange_mileage", event.target.value)
              }
              placeholder="e.g. 78000"
              className="h-11"
            />
          </label>
          <label className="grid gap-1 text-xs font-extrabold">
            Allowance (£)
            <Input
              type="number"
              min={0}
              step="0.01"
              value={values.part_exchange_allowance}
              onChange={(event) =>
                updateField("part_exchange_allowance", event.target.value)
              }
              placeholder="0"
              className="h-11 text-right tabular-nums"
            />
          </label>
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
              value={values.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className="min-h-24"
            />
          </label>
          <label className="grid gap-1 text-xs font-extrabold">
            Terms &amp; conditions
            <Textarea
              value={values.terms}
              onChange={(event) => updateField("terms", event.target.value)}
              className="min-h-24"
            />
          </label>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
          Save sale details
        </Button>
      </div>
    </div>
  );
}
