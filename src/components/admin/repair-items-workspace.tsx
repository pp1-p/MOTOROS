"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";

import { FormErrorSummary } from "@/components/forms/form-error-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RepairJobItem } from "@/lib/data/admin-repairs";
import { calculateInvoicePreview } from "@/lib/invoices/totals";
import { formatMoney } from "@/lib/invoices/format";
import { useHydrated } from "@/lib/use-hydrated";
import {
  createRepairItemSchema,
  updateRepairItemSchema,
  removeRepairItemSchema,
  repairItemStatuses,
} from "@/lib/validation/repair-items";

type Draft = {
  id: string;
  expectedUpdatedAt?: string;
  itemType: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  status: string;
  supplier: string;
  partNumber: string;
  changeReason: string;
};
type Mode = "create" | "update" | "remove";

export function RepairItemsWorkspace({
  jobId,
  items,
  canManage,
  canViewCommercial,
  isDemo,
  closed,
}: {
  jobId: string;
  items: RepairJobItem[];
  canManage: boolean;
  canViewCommercial: boolean;
  isDemo: boolean;
  closed: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const prefix = useId();
  const pending = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mode, setMode] = useState<Mode>("create");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, { message?: string }>>(
    {},
  );
  const [attempts, setAttempts] = useState(0);
  const [notice, setNotice] = useState("");
  const editable = canManage && canViewCommercial && !isDemo && !closed;
  const totals = calculateInvoicePreview(
    items.map((item) => ({
      itemType: item.itemType,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? 0,
      vatRate: item.vatRate ?? 0,
    })),
    true,
  );

  function open(nextMode: Mode, item?: RepairJobItem) {
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setMode(nextMode);
    setError(null);
    setErrors({});
    setAttempts(0);
    setDraft({
      id: item?.id ?? crypto.randomUUID(),
      expectedUpdatedAt: item?.updatedAt,
      itemType: item?.itemType ?? "labour",
      description: item?.description ?? "",
      quantity: String(item?.quantity ?? 1),
      unitPrice: String(item?.unitPrice ?? 0),
      vatRate: String(item?.vatRate ?? 20),
      status: item?.status ?? "planned",
      supplier: item?.supplier ?? "",
      partNumber: item?.partNumber ?? "",
      changeReason: "",
    });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || pending.current || uncertain) return;
    const { expectedUpdatedAt, ...fields } = draft;
    const payload =
      mode === "remove"
        ? { id: draft.id, expectedUpdatedAt, changeReason: draft.changeReason }
        : mode === "create"
          ? fields
          : { ...fields, expectedUpdatedAt };
    const schema =
      mode === "create"
        ? createRepairItemSchema
        : mode === "update"
          ? updateRepairItemSchema
          : removeRepairItemSchema;
    const parsed = schema.safeParse(payload);
    setAttempts((count) => count + 1);
    setErrors({});
    setError(null);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(
            ([name, messages]) => [name, { message: messages?.[0] }],
          ),
        ),
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/repair-jobs/${jobId}/items`, {
        method:
          mode === "create" ? "POST" : mode === "update" ? "PATCH" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(20_000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          result?.message ??
            "The change was not confirmed. Review the job before trying again.",
        );
        setErrors(
          Object.fromEntries(
            Object.entries(result?.fieldErrors ?? {}).map(
              ([name, messages]) => [
                name,
                { message: Array.isArray(messages) ? messages[0] : undefined },
              ],
            ),
          ),
        );
        if (response.status >= 500 || response.status === 409)
          setUncertain(true);
        return;
      }
      if (!result?.ok || result?.item?.id !== draft.id)
        throw new Error("Unconfirmed save");
      setNotice(result.message ?? "Item saved.");
      setDraft(null);
      router.refresh();
    } catch {
      setUncertain(true);
      setError(
        "The connection was lost or the save was not confirmed. Reload this job and check its items before making another change; it may already have saved.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function field(
    name: keyof Draft,
    label: string,
    type = "text",
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) {
    return (
      <label
        className="block min-w-0 text-xs font-bold"
        htmlFor={`${prefix}-${name}`}
      >
        {label}
        <Input
          {...props}
          id={`${prefix}-${name}`}
          name={name}
          type={type}
          className="mt-1.5"
          value={draft?.[name] ?? ""}
          onChange={(event) =>
            setDraft(
              (value) => value && { ...value, [name]: event.target.value },
            )
          }
          aria-invalid={Boolean(errors[name])}
          aria-describedby={
            errors[name] ? `${prefix}-${name}-error` : undefined
          }
        />
        {errors[name]?.message ? (
          <span
            id={`${prefix}-${name}-error`}
            className="mt-1 block text-red-700"
          >
            {errors[name].message}
          </span>
        ) : null}
      </label>
    );
  }

  return (
    <section className="min-w-0 rounded-2xl border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div>
          <h2 className="font-extrabold">Labour &amp; parts</h2>
          <p className="mt-1 text-xs text-foreground/50">
            {canViewCommercial
              ? "Prices exclude VAT. New invoices copy the items saved at creation."
              : "Labour and parts recorded for this job."}
          </p>
        </div>
        {editable ? (
          <Button
            size="sm"
            onClick={() => open("create")}
            disabled={!hydrated || uncertain}
          >
            <Plus />
            Add labour or part
          </Button>
        ) : null}
      </div>
      {notice ? (
        <p role="status" className="px-5 pt-4 text-sm font-semibold">
          {notice}
        </p>
      ) : null}
      {closed && canManage && !isDemo ? (
        <p className="px-5 pt-4 text-xs text-foreground/60">
          Reopen this job to change its labour and parts.
        </p>
      ) : null}
      {uncertain && !draft ? (
        <div
          role="alert"
          className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
        >
          Reload this job and review the latest items before making another
          change.
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Reload job
          </Button>
        </div>
      ) : null}
      {items.length ? (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <caption className="sr-only">
              Labour and parts for this repair job
            </caption>
            <thead className="border-b bg-surface-muted text-[10px] uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">
                  Description
                </th>
                <th scope="col" className="px-3 py-3">
                  Type / status
                </th>
                <th scope="col" className="px-3 py-3">
                  Qty / hours
                </th>
                {canViewCommercial ? (
                  <>
                    <th scope="col" className="px-3 py-3">
                      Rate / VAT
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      Net
                    </th>
                  </>
                ) : null}
                {editable ? (
                  <th scope="col" className="px-3 py-3">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="max-w-64 break-words px-5 py-3 font-bold">
                    {item.description}
                    {item.partNumber ? (
                      <span className="mt-1 block text-[10px] font-normal">
                        Part: {item.partNumber}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 capitalize">
                    {item.itemType}
                    <span className="mt-1 block text-[10px] text-foreground/50">
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-3">{item.quantity}</td>
                  {canViewCommercial ? (
                    <>
                      <td className="px-3 py-3">
                        {formatMoney(item.unitPrice ?? 0)}
                        <span className="mt-1 block text-[10px]">
                          VAT {item.vatRate ?? 0}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-bold">
                        {formatMoney(item.lineTotal ?? 0)}
                      </td>
                    </>
                  ) : null}
                  {editable ? (
                    <td className="px-3 py-3">
                      {["labour", "part"].includes(item.itemType) &&
                      item.updatedAt &&
                      item.status !== "cancelled" ? (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label={`Edit ${item.description}`}
                            disabled={!hydrated || uncertain}
                            onClick={() => open("update", item)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label={`Remove ${item.description}`}
                            disabled={!hydrated || uncertain}
                            onClick={() => open("remove", item)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-foreground/50">
                          Read only
                        </span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-5 text-xs text-foreground/50">
          No labour or parts have been recorded for this job.
        </p>
      )}
      {canViewCommercial ? (
        <div className="space-y-2 border-t p-5 text-xs">
          <div className="flex justify-between">
            <span>Item net after discounts</span>
            <strong>
              {formatMoney(Math.max(totals.subtotal - totals.discount, 0))}
            </strong>
          </div>
          <div className="flex justify-between">
            <span>Item VAT at recorded rates</span>
            <strong>{formatMoney(totals.vat)}</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-bold">Item total including VAT</span>
            <strong>{formatMoney(totals.total)}</strong>
          </div>
          <p className="pt-1 text-foreground/55">
            Item changes do not change the approved estimate or existing
            invoices. Invoice VAT treatment is chosen separately.
          </p>
        </div>
      ) : null}

      <Dialog.Root
        open={Boolean(draft)}
        onOpenChange={(value) => {
          if (!value && !pending.current) setDraft(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              trigger.current?.focus();
            }}
            onEscapeKeyDown={(event) => {
              if (pending.current) event.preventDefault();
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <Dialog.Title className="pr-10 text-lg font-extrabold">
              {mode === "create"
                ? "Add"
                : mode === "remove"
                  ? "Remove"
                  : "Edit"}{" "}
              labour or part
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-xs text-foreground/60">
              {mode === "remove"
                ? `Remove “${draft?.description}” from this job. Previous invoices keep their saved amounts.`
                : "Record the quantity or labour hours, selling rate and reason for this change."}
            </Dialog.Description>
            <Dialog.Close asChild>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-3 top-3"
                aria-label="Close item form"
                disabled={busy}
              >
                <X />
              </Button>
            </Dialog.Close>
            <form
              method="post"
              noValidate
              onSubmit={submit}
              className="mt-5 space-y-4"
              aria-busy={busy}
            >
              <FormErrorSummary
                errors={errors}
                submitCount={attempts}
                submitError={error}
              />
              <fieldset disabled={busy || uncertain} className="space-y-4">
                {mode !== "remove" ? (
                  <>
                    <label className="block text-xs font-bold">
                      Item type
                      <select
                        name="itemType"
                        value={draft?.itemType}
                        onChange={(event) =>
                          setDraft(
                            (value) =>
                              value && {
                                ...value,
                                itemType: event.target.value,
                              },
                          )
                        }
                        className="mt-1.5 h-11 w-full rounded-xl border px-3"
                      >
                        <option value="labour">Labour</option>
                        <option value="part">Part</option>
                      </select>
                    </label>
                    {field("description", "Description", "text", {
                      maxLength: 1000,
                    })}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {field(
                        "quantity",
                        draft?.itemType === "labour"
                          ? "Labour hours"
                          : "Quantity",
                        "number",
                        { min: 0.01, max: 10000, step: 0.01 },
                      )}
                      {field(
                        "unitPrice",
                        "Selling rate excluding VAT",
                        "number",
                        { min: 0, max: 100000, step: 0.01 },
                      )}
                      {field("vatRate", "VAT rate (%)", "number", {
                        min: 0,
                        max: 100,
                        step: 0.01,
                      })}
                      <label className="block text-xs font-bold">
                        Item status
                        <select
                          name="status"
                          value={draft?.status}
                          onChange={(event) =>
                            setDraft(
                              (value) =>
                                value && {
                                  ...value,
                                  status: event.target.value,
                                },
                            )
                          }
                          className="mt-1.5 h-11 w-full rounded-xl border px-3"
                        >
                          {repairItemStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {draft?.itemType === "part" ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {field("supplier", "Supplier (optional)", "text", {
                          maxLength: 200,
                        })}
                        {field("partNumber", "Part number (optional)", "text", {
                          maxLength: 100,
                        })}
                      </div>
                    ) : null}
                  </>
                ) : null}
                {field("changeReason", "Reason for change", "text", {
                  maxLength: 500,
                })}
                <Button type="submit" disabled={busy || uncertain}>
                  {busy ? <LoaderCircle className="animate-spin" /> : null}
                  {mode === "remove" ? "Confirm removal" : "Save item"}
                </Button>
              </fieldset>
              {uncertain ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Reload job
                </Button>
              ) : null}
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
