"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoiceNumberSequence } from "@/lib/data/admin-invoice-numbering";

const typeLabels: Record<string, string> = {
  repair: "Repair invoices",
  vehicle_sale: "Vehicle sale invoices",
  general: "General invoices",
  pro_forma: "Pro-forma invoices",
  vat: "VAT invoices",
  credit_note: "Credit notes",
  sourcing: "Sourcing invoices",
  deposit: "Deposit invoices",
};

function labelFor(type: string) {
  return typeLabels[type] ?? type;
}

type Draft = InvoiceNumberSequence & { saving?: boolean };

export function InvoiceNumberingWorkspace({
  initial,
  canManage,
}: {
  initial: InvoiceNumberSequence[];
  canManage: boolean;
}) {
  const [rows, setRows] = useState<Draft[]>(initial);

  function updateRow(type: string, patch: Partial<Draft>) {
    setRows((current) =>
      current.map((row) => (row.type === type ? { ...row, ...patch } : row)),
    );
  }

  async function save(row: Draft) {
    updateRow(row.type, { saving: true });
    try {
      const res = await fetch(
        `/api/admin/settings/invoice-numbering/${encodeURIComponent(row.type)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prefix: row.prefix,
            next_number: row.nextNumber,
            digits: row.digits,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(body.message ?? "Could not save the numbering settings");
      }
      toast.success(`${labelFor(row.type)} updated.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save",
      );
    } finally {
      updateRow(row.type, { saving: false });
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b bg-surface-muted text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-foreground/55">
          <tr>
            <th className="px-5 py-3">Invoice type</th>
            <th className="px-5 py-3">Prefix</th>
            <th className="px-5 py-3">Next number</th>
            <th className="px-5 py-3">Digits</th>
            <th className="px-5 py-3">Preview</th>
            {canManage ? <th className="px-5 py-3" /> : null}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const preview = `${row.prefix}-${String(row.nextNumber).padStart(row.digits, "0")}`;
            return (
              <tr key={row.type}>
                <td className="px-5 py-3 font-extrabold">{labelFor(row.type)}</td>
                <td className="px-5 py-3">
                  <Input
                    value={row.prefix}
                    onChange={(event) =>
                      updateRow(row.type, {
                        prefix: event.target.value.toUpperCase(),
                      })
                    }
                    maxLength={8}
                    className="h-10 max-w-[8rem] uppercase tracking-wider"
                    disabled={!canManage}
                  />
                </td>
                <td className="px-5 py-3">
                  <Input
                    value={String(row.nextNumber)}
                    onChange={(event) =>
                      updateRow(row.type, {
                        nextNumber: Math.max(
                          1,
                          Number(event.target.value) || 1,
                        ),
                      })
                    }
                    type="number"
                    min={1}
                    className="h-10 max-w-[10rem] text-right tabular-nums"
                    disabled={!canManage}
                  />
                </td>
                <td className="px-5 py-3">
                  <Input
                    value={String(row.digits)}
                    onChange={(event) =>
                      updateRow(row.type, {
                        digits: Math.min(
                          9,
                          Math.max(1, Number(event.target.value) || 4),
                        ),
                      })
                    }
                    type="number"
                    min={1}
                    max={9}
                    className="h-10 max-w-[5rem] text-right tabular-nums"
                    disabled={!canManage}
                  />
                </td>
                <td className="px-5 py-3 font-mono text-xs font-extrabold text-foreground/70">
                  {preview}
                </td>
                {canManage ? (
                  <td className="px-5 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void save(row)}
                      disabled={row.saving}
                    >
                      {row.saving ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Save />
                      )}
                      Save
                    </Button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
