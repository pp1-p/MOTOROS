"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Values = {
  reported_fault: string;
  diagnosis: string;
  work_completed: string;
  technician_notes: string;
  recommendations: string;
  warranty: string;
  notes: string;
  terms: string;
};

export function RepairNarrativeEditForm({
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
      const res = await fetch(
        `/api/admin/invoices/${invoiceId}/repair-narrative`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(body.message ?? "Could not save the narrative");
      }
      toast.success("Repair narrative updated.");
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

  const fields: [keyof Values, string, string][] = [
    ["reported_fault", "Reported fault", "What the customer described."],
    ["diagnosis", "Diagnosis", "What we found on inspection."],
    ["work_completed", "Work completed", "The jobs we carried out."],
    ["technician_notes", "Technician notes", "Internal notes for the record."],
    ["recommendations", "Recommendations", "Advisories the customer should plan for."],
    ["warranty", "Warranty", "Parts & labour guarantee wording."],
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-brand">
          Workshop narrative
        </h2>
        <p className="mt-1 text-xs text-foreground/60">
          Edit any of the customer-facing narrative fields. Line items,
          totals, VAT and payments are locked from this form — use{" "}
          <span className="font-extrabold">Duplicate</span> if you need a
          full re-issue.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {fields.map(([key, label, helper]) => (
            <label key={key} className="grid gap-1 text-xs font-extrabold">
              {label}
              <Textarea
                value={values[key]}
                onChange={(event) => updateField(key, event.target.value)}
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
              value={values.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className="min-h-24"
              placeholder="Anything the customer needs to see below the totals."
            />
          </label>
          <label className="grid gap-1 text-xs font-extrabold">
            Payment terms
            <Textarea
              value={values.terms}
              onChange={(event) => updateField("terms", event.target.value)}
              className="min-h-24"
              placeholder="e.g. Payment due on collection. Bank details on file."
            />
          </label>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
          Save narrative
        </Button>
      </div>
    </div>
  );
}
