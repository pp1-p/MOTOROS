import { format, isToday, isTomorrow, parseISO } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleDollarSign,
  FileText,
  Mail,
  Phone,
  Printer,
  UserRound,
  Wrench,
} from "lucide-react";

import { AsyncForm } from "@/components/admin/async-form";
import { CreateRepairInvoiceButtons } from "@/components/admin/create-repair-invoice-buttons";
import { Notice, StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  isTechnicianRepairStatus,
  technicianRepairStatusValues,
} from "@/lib/auth/repair-access";
import {
  displayRepairStatus,
  getRepairDetail,
  repairStatusValues,
} from "@/lib/data/admin-repairs";
import { formatCurrency } from "@/lib/utils";
import { getInvoicesForRepair } from "@/lib/data/admin-invoices";
import {
  formatMoney,
  invoiceStatusLabel,
  invoiceStatusTone,
  invoiceTypeLabel,
} from "@/lib/invoices/format";

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = parseISO(value);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "d MMM yyyy");
}

function timestampLabel(value: string) {
  return format(new Date(value), "d MMM yyyy, HH:mm");
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function RepairJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const {
    job,
    isDemo,
    canManage,
    canViewCustomerDetails,
    canViewCommercial,
  } = await getRepairDetail(id);
  if (!job) notFound();
  const repairInvoices = isDemo ? [] : await getInvoicesForRepair(job.id);
  const finalInvoice = repairInvoices.find((invoice) => invoice.type === "repair");
  const estimateInvoices = repairInvoices.filter(
    (invoice) => invoice.type === "pro_forma",
  );
  const technicianCanChangeStatus = isTechnicianRepairStatus(job.status);
  const allowedStatusValues =
    isDemo || canManage
      ? repairStatusValues
      : technicianCanChangeStatus
        ? technicianRepairStatusValues
        : [job.status];

  const jobFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-[11px] font-extrabold sm:col-span-2">
        Reported fault
        <Textarea
          name="reportedFault"
          defaultValue={job.reportedFault}
          className="mt-1.5"
          disabled={isDemo || !canManage}
          required
        />
      </label>
      <label className="text-[11px] font-extrabold sm:col-span-2">
        Diagnosis
        <Textarea
          name="diagnosis"
          defaultValue={job.diagnosis ?? ""}
          className="mt-1.5"
          disabled={isDemo}
        />
      </label>
      <label className="text-[11px] font-extrabold sm:col-span-2">
        Work completed
        <Textarea
          name="workCompleted"
          defaultValue={job.workCompleted ?? ""}
          className="mt-1.5"
          disabled={isDemo}
        />
      </label>
      <label className="text-[11px] font-extrabold">
        Assigned technician
        <select
          name="assignedTechnicianId"
          defaultValue={job.assignedTechnicianId ?? ""}
          className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm disabled:bg-surface-muted disabled:text-foreground/50"
          disabled={isDemo || !canManage}
        >
          <option value="">Unassigned</option>
          {job.technicians.map((technician) => (
            <option key={technician.id} value={technician.id}>
              {technician.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] font-extrabold">
        Status
        <select
          name="status"
          defaultValue={job.status}
          className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm disabled:bg-surface-muted disabled:text-foreground/50"
          disabled={isDemo || (!canManage && !technicianCanChangeStatus)}
        >
          {allowedStatusValues.map((status) => (
            <option key={status} value={status}>
              {displayRepairStatus(status)}
            </option>
          ))}
        </select>
        {!isDemo && !canManage && !technicianCanChangeStatus ? (
          <span className="mt-1.5 block text-[10px] font-medium text-foreground/45">
            A manager must change this status.
          </span>
        ) : null}
      </label>
      <label className="text-[11px] font-extrabold">
        Current mileage
        <Input
          name="mileage"
          type="number"
          min={0}
          max={2_000_000}
          defaultValue={job.mileage ?? ""}
          className="mt-1.5"
          disabled={isDemo || !canManage}
        />
      </label>
      <label className="text-[11px] font-extrabold">
        Target completion
        <Input
          name="dueDate"
          type="date"
          defaultValue={job.dueDate ?? ""}
          className="mt-1.5"
          disabled={isDemo || !canManage}
        />
      </label>
      <label className="text-[11px] font-extrabold">
        Customer approval
        <select
          name="approvalStatus"
          defaultValue={job.approvalStatus ?? "not_requested"}
          className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm disabled:bg-surface-muted disabled:text-foreground/50"
          disabled={isDemo || !canManage}
        >
          <option value="not_requested">Not requested</option>
          <option value="requested">Requested</option>
          <option value="approved">Approved</option>
          <option value="partially_approved">Partially approved</option>
          <option value="declined">Declined</option>
        </select>
      </label>
      <label className="text-[11px] font-extrabold">
        Estimate net
        <Input
          name="estimateNet"
          type="number"
          min={0}
          max={2_000_000}
          step="0.01"
          defaultValue={job.estimateNet ?? ""}
          className="mt-1.5"
          disabled={isDemo || !canManage}
        />
      </label>
      <label className="text-[11px] font-extrabold">
        VAT amount
        <Input
          name="vatAmount"
          type="number"
          min={0}
          max={2_000_000}
          step="0.01"
          defaultValue={job.estimateVat ?? ""}
          className="mt-1.5"
          disabled={isDemo || !canManage}
        />
      </label>
      {!isDemo ? (
        <label className="text-[11px] font-extrabold sm:col-span-2">
          Reason for change
          <Input
            name="changeReason"
            minLength={3}
            maxLength={500}
            placeholder="For example: diagnosis confirmed after inspection"
            className="mt-1.5"
            required
          />
        </label>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="icon">
          <Link href="/admin/repairs" aria-label="Back to repairs">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-[-0.035em] sm:text-2xl">
              {job.reference} · {job.vehicle}
            </h1>
            <StatusPill status={displayRepairStatus(job.status)} />
          </div>
          <p className="mt-1 text-xs text-foreground/45">
            {job.registration}
            {canViewCustomerDetails && job.customerName
              ? ` · ${job.customerName}`
              : ""}
            {` · Due ${dateLabel(job.dueDate)}`}
          </p>
        </div>
        {job.customerPhone ? (
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${job.customerPhone.replace(/[^\d+]/g, "")}`}>
              <Phone />
              Call customer
            </a>
          </Button>
        ) : null}
        {!isDemo ? (
          <Button asChild variant="outline" size="sm">
            <a href={`/api/admin/repairs/${job.id}/print`} target="_blank">
              <Printer />
              Job sheet
            </a>
          </Button>
        ) : null}
      </div>

      {isDemo ? (
        <Notice title="Read-only demo job" tone="info">
          Connect Supabase to save repair updates, print a live job sheet, or securely download
          linked documents.
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ...(canViewCustomerDetails && job.customerName
            ? [[UserRound, "Customer", job.customerName]]
            : []),
          [Wrench, "Technician", job.technicianName],
          [CalendarDays, "Target completion", dateLabel(job.dueDate)],
          ...(canViewCommercial
            ? [
                [
                  CircleDollarSign,
                  "Estimate",
                  (job.estimateTotal ?? 0) > 0
                    ? formatCurrency(job.estimateTotal ?? 0)
                    : "Pending",
                ],
              ]
            : []),
        ].map(([Icon, label, value]) => {
          const Component = Icon as typeof UserRound;
          return (
            <div key={String(label)} className="flex gap-3 rounded-xl border bg-white p-4">
              <Component className="size-4 shrink-0 text-brand" />
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/35">
                  {String(label)}
                </p>
                <p className="mt-1 text-xs font-extrabold">{String(value)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Job details</h2>
              <p className="mt-1 text-xs text-foreground/42">
                Diagnosis, approval and technician work record.
              </p>
            </div>
            {isDemo ? (
              <div className="p-5">{jobFields}</div>
            ) : (
              <AsyncForm endpoint={`/api/repair-jobs/${job.id}`} className="p-5">
                {jobFields}
              </AsyncForm>
            )}
          </section>

          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Labour &amp; parts</h2>
              <p className="mt-1 text-xs text-foreground/42">
                {canViewCommercial
                  ? "Live job items. Prices shown excluding VAT."
                  : "Live labour and parts recorded for this job."}
              </p>
            </div>
            {job.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="border-b bg-[#fafaf8] text-[9px] font-extrabold uppercase tracking-wider text-foreground/38">
                    <tr>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Qty / hours</th>
                      {canViewCommercial ? (
                        <>
                          <th className="px-4 py-3">Rate</th>
                          <th className="px-5 py-3 text-right">Total</th>
                        </>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {job.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-3 font-bold">{item.description}</td>
                        <td className="px-4 py-3 capitalize text-foreground/50">
                          {item.itemType}
                        </td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        {canViewCommercial ? (
                          <>
                            <td className="px-4 py-3">
                              {formatCurrency(item.unitPrice ?? 0)}
                            </td>
                            <td className="px-5 py-3 text-right font-extrabold">
                              {formatCurrency(item.lineTotal ?? 0)}
                            </td>
                          </>
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
              <div className="ml-auto w-full max-w-xs space-y-2 border-t p-5 text-xs">
                <div className="flex justify-between">
                  <span className="text-foreground/45">Subtotal</span>
                  <strong>{formatCurrency(job.estimateNet ?? 0)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/45">VAT</span>
                  <strong>{formatCurrency(job.estimateVat ?? 0)}</strong>
                </div>
                <div className="flex justify-between border-t pt-2 text-base">
                  <span className="font-extrabold">Estimate total</span>
                  <strong>{formatCurrency(job.estimateTotal ?? 0)}</strong>
                </div>
                {job.customerEmail && (job.estimateTotal ?? 0) > 0 ? (
                  <Button asChild size="sm" className="mt-3 w-full">
                    <a
                      href={`mailto:${encodeURIComponent(job.customerEmail)}?subject=${encodeURIComponent(`Repair estimate ${job.reference}`)}`}
                    >
                      <Mail />
                      Send estimate for approval
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-sm font-extrabold text-amber-950">
                Internal technician notes
              </h2>
              <p className="mt-1 text-[10px] font-bold text-amber-900/55">
                Never shared with the customer.
              </p>
              {isDemo ? (
                <Textarea
                  className="mt-3 bg-white"
                  defaultValue={job.technicianNotes ?? ""}
                  disabled
                />
              ) : (
                <AsyncForm
                  endpoint={`/api/repair-jobs/${job.id}`}
                  buttonClassName="justify-start"
                  submitLabel="Save internal note"
                >
                  <Textarea
                    name="technicianNotes"
                    className="mt-3 bg-white"
                    defaultValue={job.technicianNotes ?? ""}
                  />
                  <input
                    type="hidden"
                    name="changeReason"
                    value="Updated internal technician note"
                  />
                </AsyncForm>
              )}
            </div>
            <div className="rounded-2xl border bg-white p-5">
              <h2 className="text-sm font-extrabold">Customer-facing notes</h2>
              <p className="mt-1 text-[10px] text-foreground/45">
                Included in approved communications and job summary.
              </p>
              {isDemo || !canManage ? (
                <Textarea
                  className="mt-3"
                  defaultValue={job.customerFacingNotes ?? ""}
                  disabled
                />
              ) : (
                <AsyncForm
                  endpoint={`/api/repair-jobs/${job.id}`}
                  buttonClassName="justify-start"
                  submitLabel="Save customer note"
                >
                  <Textarea
                    name="customerFacingNotes"
                    className="mt-3"
                    defaultValue={job.customerFacingNotes ?? ""}
                  />
                  <input
                    type="hidden"
                    name="changeReason"
                    value="Updated customer-facing repair note"
                  />
                </AsyncForm>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          {job.timeline.length > 0 ? (
            <section className="rounded-2xl border bg-white">
              <div className="border-b p-5">
                <h2 className="font-extrabold">Repair timeline</h2>
                <p className="mt-1 text-xs text-foreground/42">
                  Latest activity first
                </p>
              </div>
              <div className="p-5">
                {job.timeline.map((entry, index) => (
                  <div key={entry.id} className="relative flex gap-3 pb-6 last:pb-0">
                    {index < job.timeline.length - 1 ? (
                      <span className="absolute left-[13px] top-7 h-[calc(100%-8px)] w-px bg-border" />
                    ) : null}
                    <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft">
                      <Check className="size-3.5 text-brand" />
                    </span>
                    <div className="pt-0.5">
                      <p className="text-xs font-extrabold">{entry.title}</p>
                      <p className="mt-1 text-[10px] leading-4 text-foreground/45">
                        {entry.detail}
                      </p>
                      <p className="mt-1 text-[9px] font-bold text-foreground/30">
                        {timestampLabel(entry.occurredAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-extrabold">Documents &amp; images</h2>
            {job.documents.length > 0 ? (
              <div className="mt-3 space-y-2">
                {job.documents.map((document) => (
                  <a
                    key={document.id}
                    href={`/api/admin/documents/${document.id}/download`}
                    className="flex items-center gap-2 rounded-lg border p-2.5 hover:bg-surface-muted"
                  >
                    <FileText className="size-4 text-brand" />
                    <span className="min-w-0 flex-1 truncate text-[10px] font-bold">
                      {document.name}
                    </span>
                    <span className="text-[9px] text-foreground/35">
                      {formatBytes(document.byteSize)}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-foreground/45">
                No documents are linked to this repair job.
              </p>
            )}
          </section>

          {!isDemo ? (
            <section className="rounded-2xl border bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-extrabold">
                  <FileText className="size-4 text-brand" />
                  Invoicing
                </h2>
              </div>
              {finalInvoice ? (
                <div className="mt-3 rounded-xl border bg-[#fafaf8] p-3">
                  <Link
                    href={`/admin/invoices/${finalInvoice.id}`}
                    className="text-xs font-extrabold text-brand hover:underline"
                  >
                    {finalInvoice.invoiceNumber}
                  </Link>
                  <p className="mt-0.5 text-[10px] text-foreground/55">
                    {formatMoney(finalInvoice.total, finalInvoice.currency)} total ·{" "}
                    <span className="font-extrabold text-amber-800">
                      {formatMoney(finalInvoice.balance, finalInvoice.currency)} due
                    </span>
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-extrabold ${invoiceStatusTone(finalInvoice.status)}`}
                  >
                    {invoiceStatusLabel(finalInvoice.status)}
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-5 text-foreground/50">
                  No final invoice yet. Create one when the job&apos;s labour
                  and parts are complete.
                </p>
              )}
              {estimateInvoices.length > 0 ? (
                <div className="mt-4 border-t pt-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/45">
                    Estimates ({estimateInvoices.length})
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {estimateInvoices.map((invoice) => (
                      <li
                        key={invoice.id}
                        className="flex items-center justify-between rounded-lg border p-2"
                      >
                        <Link
                          href={`/admin/invoices/${invoice.id}`}
                          className="text-[10px] font-extrabold text-brand hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                        <span className="text-[10px] font-semibold text-foreground/60 tabular-nums">
                          {formatMoney(invoice.total, invoice.currency)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold ${invoiceStatusTone(invoice.status)}`}
                        >
                          {invoiceTypeLabel(invoice.type)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {canManage ? (
                <div className="mt-4 border-t pt-3">
                  <CreateRepairInvoiceButtons
                    repairJobId={job.id}
                    canCreateFinal={!finalInvoice}
                  />
                  <p className="mt-2 text-[10px] leading-4 text-foreground/45">
                    Estimates can be re-issued as you refine the job; only one
                    final invoice per repair.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          <Notice title="Customer privacy" tone="info">
            Internal notes and private documents are omitted from customer-facing messages and
            protected by signed download URLs.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
