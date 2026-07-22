import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import {
  IssueCreditNoteForm,
  RefundCreditNoteButton,
  VoidInvoiceButton,
} from "@/components/admin/credit-note-actions";
import { InvoicePaymentForm } from "@/components/admin/invoice-payment-form";
import { PageHeader } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { requireStaff, hasPermission } from "@/lib/auth/permissions";
import { getInvoiceById } from "@/lib/data/admin-invoices";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  invoiceStatusLabel,
  invoiceStatusTone,
  invoiceTypeLabel,
  lineItemLabel,
  paymentMethodLabel,
  vatTreatmentLabel,
} from "@/lib/invoices/format";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff("invoices:view");
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const canRecordPayment = hasPermission(staff.role, "invoices:record_payment");
  const canIssueCredit = hasPermission(staff.role, "invoices:issue_credit");
  const totalPayments = invoice.payments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );
  const creditableRemaining = Math.max(
    invoice.total - invoice.creditedTotal,
    0,
  );
  const canVoid =
    canIssueCredit &&
    ["sent", "viewed", "partially_paid"].includes(invoice.status) &&
    invoice.amountPaid <= 0 &&
    invoice.creditNotes.filter((note) => note.status !== "cancelled").length ===
      0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={invoiceTypeLabel(invoice.type)}
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`${invoice.customerName}${invoice.vehicleRegistration ? ` · ${invoice.vehicleRegistration}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold ${invoiceStatusTone(invoice.status)}`}
            >
              {invoiceStatusLabel(invoice.status)}
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/invoices/${invoice.id}/print`} target="_blank">
                <Printer />
                Print / PDF
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/invoices">
                <ArrowLeft />
                All invoices
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Charges</h2>
              <p className="mt-1 text-xs text-foreground/45">
                Itemised from the linked sale. VAT treatment:{" "}
                <span className="font-bold text-foreground/70">
                  {vatTreatmentLabel(invoice.vatTreatment)}
                </span>
                .
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="border-b bg-[#fafaf8] text-[10px] font-extrabold uppercase tracking-wider text-foreground/38">
                  <tr>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit</th>
                    <th className="px-4 py-3 text-right">VAT</th>
                    <th className="px-5 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-semibold">
                  {invoice.lineItems.map((line) => (
                    <tr
                      key={line.id}
                      className={line.itemType === "discount" ? "text-emerald-800" : ""}
                    >
                      <td className="px-5 py-3">
                        <span className="block font-extrabold">
                          {line.description}
                        </span>
                        <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-foreground/45">
                          {lineItemLabel(line.itemType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {line.quantity}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(line.unitPrice, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground/60">
                        {line.vatRate.toFixed(0)}%
                      </td>
                      <td className="px-5 py-3 text-right font-extrabold tabular-nums">
                        {line.itemType === "discount" ? "−" : ""}
                        {formatMoney(line.lineTotal, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t bg-[#fafaf8] p-5">
              <dl className="ml-auto grid max-w-xs gap-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-foreground/55">Subtotal</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMoney(invoice.subtotalNet, invoice.currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground/55">Discounts</dt>
                  <dd className="font-semibold tabular-nums text-emerald-700">
                    −{formatMoney(invoice.discountTotal, invoice.currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground/55">VAT</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMoney(invoice.vatTotal, invoice.currency)}
                  </dd>
                </div>
                <div className="mt-1 flex justify-between border-t pt-2">
                  <dt className="font-extrabold">Total</dt>
                  <dd className="font-extrabold tabular-nums">
                    {formatMoney(invoice.total, invoice.currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground/55">Paid</dt>
                  <dd className="font-semibold tabular-nums text-emerald-700">
                    {formatMoney(invoice.amountPaid, invoice.currency)}
                  </dd>
                </div>
                {invoice.creditedTotal > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-foreground/55">Credited</dt>
                    <dd className="font-semibold tabular-nums text-purple-700">
                      −{formatMoney(invoice.creditedTotal, invoice.currency)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between rounded-lg bg-white px-3 py-2">
                  <dt className="font-extrabold text-amber-800">Balance</dt>
                  <dd className="font-extrabold tabular-nums text-amber-800">
                    {formatMoney(invoice.balance, invoice.currency)}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-extrabold">Payments</h2>
            {invoice.payments.length ? (
              <ol className="mt-4 space-y-3">
                {invoice.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <div>
                      <p className="text-xs font-extrabold">
                        {paymentMethodLabel(payment.method)}
                        {payment.reference ? (
                          <span className="ml-2 text-foreground/50">
                            · {payment.reference}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[10px] text-foreground/50">
                        {formatDateTime(payment.paidAt)}
                        {payment.notes ? ` · ${payment.notes}` : ""}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-extrabold tabular-nums ${payment.amount < 0 ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {payment.amount < 0 ? "−" : ""}
                      {formatMoney(Math.abs(payment.amount), invoice.currency)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between border-t pt-3">
                  <p className="text-xs font-extrabold">Total received</p>
                  <p className="text-sm font-extrabold tabular-nums">
                    {formatMoney(totalPayments, invoice.currency)}
                  </p>
                </li>
              </ol>
            ) : (
              <p className="mt-4 text-xs text-foreground/50">
                No payments recorded yet.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-extrabold">Customer</h2>
            <p className="mt-3 text-sm font-extrabold">{invoice.customerName}</p>
            {invoice.customerEmail ? (
              <p className="text-xs text-foreground/55">{invoice.customerEmail}</p>
            ) : null}
            {invoice.customerPhone ? (
              <p className="text-xs text-foreground/55">{invoice.customerPhone}</p>
            ) : null}
            <div className="mt-4 border-t pt-3 text-[11px] text-foreground/55">
              <p>
                Issued: <span className="font-semibold">{formatDate(invoice.issuedAt)}</span>
              </p>
              <p>
                Due: <span className="font-semibold">{formatDate(invoice.dueAt)}</span>
              </p>
              {invoice.saleId ? (
                <p className="mt-1">
                  <Link
                    href={`/admin/sales/${invoice.saleId}`}
                    className="font-extrabold text-brand hover:underline"
                  >
                    Open linked sale →
                  </Link>
                </p>
              ) : null}
            </div>
          </section>

          {canRecordPayment ? (
            <section className="rounded-2xl border bg-white p-5">
              <h2 className="font-extrabold">Record payment</h2>
              <p className="mt-1 text-xs text-foreground/45">
                Balance: {formatMoney(invoice.balance, invoice.currency)}
              </p>
              <div className="mt-4">
                <InvoicePaymentForm
                  invoiceId={invoice.id}
                  balance={invoice.balance}
                  currency={invoice.currency}
                />
              </div>
            </section>
          ) : null}

          {canIssueCredit &&
          !["draft", "cancelled", "void"].includes(invoice.status) ? (
            <section className="rounded-2xl border bg-white p-5">
              <h2 className="font-extrabold">Credit notes</h2>
              {invoice.creditNotes.length ? (
                <ol className="mt-3 space-y-3">
                  {invoice.creditNotes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-xl border p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-extrabold">{note.creditNoteNumber}</p>
                        <span className="font-extrabold tabular-nums text-purple-700">
                          −{formatMoney(note.amount, note.currency)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-foreground/55">
                        {formatDateTime(note.issuedAt)}
                        {note.status !== "issued"
                          ? ` · ${note.status}`
                          : ""}
                      </p>
                      <p className="mt-1 text-[11px]">{note.reason}</p>
                      {note.status === "issued" ? (
                        <div className="mt-2">
                          <RefundCreditNoteButton creditNoteId={note.id} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-xs text-foreground/50">
                  No credit notes on this invoice.
                </p>
              )}
              <div className="mt-4 border-t pt-3">
                <IssueCreditNoteForm
                  invoiceId={invoice.id}
                  creditableRemaining={creditableRemaining}
                  currency={invoice.currency}
                />
              </div>
              {canVoid ? (
                <div className="mt-4 border-t pt-3">
                  <VoidInvoiceButton invoiceId={invoice.id} />
                  <p className="mt-1 text-[10px] leading-4 text-foreground/45">
                    Void an unpaid invoice issued in error. Once payments or
                    credit notes exist, credit + refund is the correct flow
                    instead.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-extrabold">Activity</h2>
            {invoice.activity.length ? (
              <ol className="mt-4 space-y-3 text-xs">
                {invoice.activity.map((entry) => (
                  <li key={entry.id}>
                    <p className="font-extrabold">{entry.action.replaceAll(".", " ")}</p>
                    <p className="text-foreground/55">
                      {entry.actorName} · {formatDateTime(entry.occurredAt)}
                    </p>
                    {entry.detail ? (
                      <p className="mt-0.5 text-foreground/70">{entry.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-xs text-foreground/50">No activity yet.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
