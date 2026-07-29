"use client";

import {
  CheckCircle2,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RepairCode } from "@/lib/data/admin-repair-codes";
import {
  repairCodeCategories,
  type RepairCodeCategory,
} from "@/lib/validation/repair-codes";
import { cn } from "@/lib/utils";

type Draft = {
  id: string | null;
  code: string;
  description: string;
  default_price: string;
  labour_hours: string;
  tax_rate: string;
  category: RepairCodeCategory;
  active: boolean;
};

const emptyDraft: Draft = {
  id: null,
  code: "",
  description: "",
  default_price: "0",
  labour_hours: "0",
  tax_rate: "20",
  category: "labour",
  active: true,
};

const categoryLabels: Record<RepairCodeCategory, string> = {
  labour: "Labour",
  parts: "Parts",
  diagnostic: "Diagnostic",
  consumable: "Consumable",
  other: "Other",
};

const categoryTones: Record<RepairCodeCategory, string> = {
  labour: "bg-blue-50 text-blue-700",
  parts: "bg-amber-50 text-amber-700",
  diagnostic: "bg-violet-50 text-violet-700",
  consumable: "bg-emerald-50 text-emerald-700",
  other: "bg-slate-50 text-slate-700",
};

function toDraft(code: RepairCode): Draft {
  return {
    id: code.id,
    code: code.code,
    description: code.description,
    default_price: String(code.defaultPrice),
    labour_hours: String(code.labourHours),
    tax_rate: String(code.taxRate),
    category: code.category,
    active: code.active,
  };
}

export function RepairCodesWorkspace({
  initialCodes,
  canManage,
}: {
  initialCodes: RepairCode[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [codes, setCodes] = useState(initialCodes);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | RepairCodeCategory>("all");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return codes.filter((code) => {
      if (!showInactive && !code.active) return false;
      if (category !== "all" && code.category !== category) return false;
      if (!term) return true;
      return (
        code.code.toLowerCase().includes(term) ||
        code.description.toLowerCase().includes(term)
      );
    });
  }, [codes, search, category, showInactive]);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const isCreate = draft.id === null;
    const url = isCreate
      ? "/api/admin/repair-codes"
      : `/api/admin/repair-codes/${draft.id}`;
    const method = isCreate ? "POST" : "PATCH";
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: draft.code,
          description: draft.description,
          default_price: Number(draft.default_price),
          labour_hours: Number(draft.labour_hours),
          tax_rate: Number(draft.tax_rate),
          category: draft.category,
          active: draft.active,
        }),
      });
      const body: {
        message?: string;
        fieldErrors?: Record<string, string[]>;
      } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? "Could not save the repair code");
        if (body.fieldErrors) setFieldErrors(body.fieldErrors);
        return;
      }
      setDraft(null);
      router.refresh();
      const refresh = await fetch(
        "/api/admin/repair-codes?includeInactive=1",
        { cache: "no-store" },
      );
      if (refresh.ok) {
        const data = (await refresh.json()) as { codes: RepairCode[] };
        setCodes(data.codes);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save the repair code",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Retire this repair code? Existing invoices keep their line items.")) {
      return;
    }
    const res = await fetch(`/api/admin/repair-codes/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      alert(body.message ?? "Could not delete the code");
      return;
    }
    setCodes((current) => current.filter((code) => code.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4">
        <label className="relative flex-1 min-w-[220px]">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground/40"
            aria-hidden
          />
          <span className="sr-only">Search codes</span>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 pl-9"
            placeholder="Search code or description"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-extrabold">
          Category
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as "all" | RepairCodeCategory)
            }
            className="h-10 rounded-xl border bg-white px-3 text-xs font-extrabold"
          >
            <option value="all">All</option>
            {repairCodeCategories.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabels[cat]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-extrabold">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            className="size-4 accent-brand"
          />
          Show inactive
        </label>
        {canManage ? (
          <Button
            type="button"
            className="ml-auto"
            onClick={() => {
              setDraft({ ...emptyDraft });
              setError(null);
              setFieldErrors({});
            }}
          >
            <Plus />
            New code
          </Button>
        ) : null}
      </div>

      {draft ? (
        <div className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-extrabold">
              {draft.id ? `Edit ${draft.code || "code"}` : "New repair code"}
            </h2>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg p-1 text-foreground/60 hover:bg-surface-muted"
              aria-label="Close editor"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DraftField
              label="Code"
              value={draft.code}
              onChange={(value) =>
                setDraft({ ...draft, code: value.toUpperCase() })
              }
              placeholder="e.g. LAB-DIAG-01"
              error={fieldErrors.code?.[0]}
              className="uppercase"
            />
            <DraftField
              label="Category"
              value={draft.category}
              onChange={(value) =>
                setDraft({ ...draft, category: value as RepairCodeCategory })
              }
              error={fieldErrors.category?.[0]}
              as="select"
              options={repairCodeCategories.map((cat) => ({
                value: cat,
                label: categoryLabels[cat],
              }))}
            />
            <DraftField
              label="Default price (£)"
              value={draft.default_price}
              onChange={(value) => setDraft({ ...draft, default_price: value })}
              type="number"
              step="0.01"
              min={0}
              error={fieldErrors.default_price?.[0]}
            />
            <DraftField
              label="Labour hours"
              value={draft.labour_hours}
              onChange={(value) => setDraft({ ...draft, labour_hours: value })}
              type="number"
              step="0.25"
              min={0}
              error={fieldErrors.labour_hours?.[0]}
            />
            <DraftField
              label="Tax rate (%)"
              value={draft.tax_rate}
              onChange={(value) => setDraft({ ...draft, tax_rate: value })}
              type="number"
              step="0.5"
              min={0}
              max={100}
              error={fieldErrors.tax_rate?.[0]}
            />
            <label className="flex items-end gap-2 pb-1 text-xs font-extrabold">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) =>
                  setDraft({ ...draft, active: event.target.checked })
                }
                className="size-4 accent-brand"
              />
              Active (shows in the code picker)
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <DraftField
                label="Description"
                value={draft.description}
                onChange={(value) => setDraft({ ...draft, description: value })}
                placeholder="e.g. Front brake pad replacement (per axle)"
                error={fieldErrors.description?.[0]}
              />
            </div>
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraft(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
              {draft.id ? "Save changes" : "Create code"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-foreground/50">
            {codes.length === 0
              ? "No repair codes yet. Add one to get started."
              : "No codes match those filters."}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b bg-surface-muted text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-foreground/55">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Labour</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3">Status</th>
                {canManage ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((code) => (
                <tr key={code.id} className={cn(!code.active && "opacity-60")}>
                  <td className="px-4 py-3 font-extrabold tabular-nums">
                    {code.code}
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    {code.description}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                        categoryTones[code.category],
                      )}
                    >
                      {categoryLabels[code.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    £{code.defaultPrice.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {code.labourHours.toFixed(2)}h
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {code.taxRate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    {code.active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-extrabold text-foreground/45">
                        Inactive
                      </span>
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDraft(toDraft(code));
                            setError(null);
                            setFieldErrors({});
                          }}
                          className="rounded-lg p-1.5 text-foreground/60 hover:bg-surface-muted"
                          aria-label={`Edit ${code.code}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(code.id)}
                          className="rounded-lg p-1.5 text-foreground/60 hover:bg-red-50 hover:text-red-700"
                          aria-label={`Retire ${code.code}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

type DraftFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  min?: number;
  max?: number;
  error?: string;
  className?: string;
  as?: "input" | "select";
  options?: { value: string; label: string }[];
};

function DraftField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
  min,
  max,
  error,
  className,
  as = "input",
  options = [],
}: DraftFieldProps) {
  const control =
    as === "select" ? (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-10 w-full rounded-xl border bg-white px-3 text-sm",
          className,
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ) : (
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        step={step}
        min={min}
        max={max}
        className={cn("h-10", className)}
      />
    );
  return (
    <label className="grid gap-1 text-xs font-extrabold text-foreground/70">
      {label}
      {control}
      {error ? (
        <span role="alert" className="text-[11px] font-bold text-red-700">
          {error}
        </span>
      ) : null}
    </label>
  );
}
