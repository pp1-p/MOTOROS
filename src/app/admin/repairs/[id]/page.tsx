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
import { Notice, StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  displayRepairStatus,
  getRepairDetail,
  repairStatusValues,
} from "@/lib/data/admin-repairs";
import { formatCurrency } from "@/lib/utils";

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
  const { job, isDemo, canManage } = await getRepairDetail(id);
  if (!job) notFound();

  const jobFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-[11px] font-extrabold sm:col-span-2">
        Reported fault
        <Textarea
          name="reportedFault"
          defaultValue={job.reportedFault}
          className="mt-1.5"
          disabled={isDemo}
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
          disabled={isDemo}
        >
          {repairStatusValues.map((status) => (
            <option key={status} value={status}>
              {displayRepairStatus(status)}
            </option>
          ))}
        </select>
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
          disabled={isDemo}
        />
      </label>
      <label className="text-[11px] font-extrabold">
        Target completion
        <Input
          name="dueDate"
          type="date"
          defaultValue={job.dueDate ?? ""}
          className="mt-1.5"
          disabled={isDemo}
        />
      </label>
      <label className="text-[11px] font-extrabold">
        Customer approval
        <select
          name="approvalStatus"
          defaultValue={job.approvalStatus}
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
          defaultValue={job.estimateNet}
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
          defaultValue={job.estimateVat}
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
            {job.registration} · {job.customerName} · Due {dateLabel(job.dueDate)}
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
          [UserRound, "Customer", job.customerName],
          [Wrench, "Technician", job.technicianName],
          [CalendarDays, "Target completion", dateLabel(job.dueDate)],
          [
            CircleDollarSign,
            "Estimate",
            job.estimateTotal > 0 ? formatCurrency(job.estimateTotal) : "Pending",
          ],
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
                Live job items. Prices shown excluding VAT.
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
                      <th className="px-4 py-3">Rate</th>
                      <th className="px-5 py-3 text-right">Total</th>
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
                        <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-5 py-3 text-right font-extrabold">
                          {formatCurrency(item.lineTotal)}
                        </td>
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
            <div className="ml-auto w-full max-w-xs space-y-2 border-t p-5 text-xs">
              <div className="flex justify-between">
                <span className="text-foreground/45">Subtotal</span>
                <strong>{formatCurrency(job.estimateNet)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/45">VAT</span>
                <strong>{formatCurrency(job.estimateVat)}</strong>
              </div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="font-extrabold">Estimate total</span>
                <strong>{formatCurrency(job.estimateTotal)}</strong>
              </div>
              {job.customerEmail && job.estimateTotal > 0 ? (
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
              {isDemo ? (
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
          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Repair timeline</h2>
              <p className="mt-1 text-xs text-foreground/42">Latest activity first</p>
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

          <Notice title="Customer privacy" tone="info">
            Internal notes and private documents are omitted from customer-facing messages and
            protected by signed download URLs.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
