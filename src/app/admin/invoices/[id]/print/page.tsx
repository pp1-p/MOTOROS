import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/auth/permissions";
import { getInvoiceById } from "@/lib/data/admin-invoices";
import { getPublicSiteConfig } from "@/lib/data/site-config";
import {
  formatDate,
  formatMoney,
  invoiceStatusLabel,
  invoiceTypeLabel,
  paymentMethodLabel,
  vatTreatmentLabel,
} from "@/lib/invoices/format";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("invoices:view");
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();
  const config = await getPublicSiteConfig();

  return (
    <div className="min-h-screen bg-white p-8 text-sm text-[#0f150f] print:p-0">
      <style>{`@page { size: A4; margin: 18mm; }`}</style>
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-start justify-between gap-6 border-b-2 border-[#0f150f] pb-6">
          <div>
            <h1 className="font-display text-4xl tracking-[-0.03em]">
              {config.name}
            </h1>
            <address className="mt-3 text-xs not-italic leading-5 text-foreground/70">
              {config.phone ? <div>{config.phone}</div> : null}
              {config.email ? <div>{config.email}</div> : null}
              {config.address ? <div className="whitespace-pre-line">{config.address}</div> : null}
              {invoice.vatRegistration ? (
                <div className="mt-1 font-extrabold text-foreground">
                  VAT number: {invoice.vatRegistration}
                </div>
              ) : null}
            </address>
          </div>
          <div className="text-right">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-foreground/55">
              {invoiceTypeLabel(invoice.type)}
            </p>
            <p className="mt-1 font-display text-4xl tracking-[-0.03em]">
              {invoice.invoiceNumber}
            </p>
            <p className="mt-2 text-xs">
              Issued <span className="font-extrabold">{formatDate(invoice.issuedAt)}</span>
            </p>
            <p className="text-xs">
              Due <span className="font-extrabold">{formatDate(invoice.dueAt)}</span>
            </p>
            <p className="mt-2 inline-block rounded-full border px-3 py-1 text-[10px] font-extrabold">
              {invoiceStatusLabel(invoice.status)}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 text-xs">
          <div>
            <p className="mb-1 font-extrabold uppercase tracking-wider text-foreground/50">
              Bill to
            </p>
            <p className="font-extrabold">{invoice.customerName}</p>
            {invoice.customerEmail ? <p>{invoice.customerEmail}</p> : null}
            {invoice.customerPhone ? <p>{invoice.customerPhone}</p> : null}
          </div>
          {invoice.vehicleDescription ? (
            <div>
              <p className="mb-1 font-extrabold uppercase tracking-wider text-foreground/50">
                Vehicle
              </p>
              <p className="font-extrabold">{invoice.vehicleDescription}</p>
              {invoice.vehicleRegistration ? (
                <p className="mt-1 rounded-md bg-[#f2e6bd] px-2 py-0.5 font-mono text-xs font-black tracking-wide">
                  {invoice.vehicleRegistration}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-[#0f150f] text-left uppercase tracking-wider text-foreground/50">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit</th>
              <th className="py-2 text-right">VAT</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((line) => (
              <tr key={line.id} className="border-b border-foreground/15">
                <td className="py-2">{line.description}</td>
                <td className="py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(line.unitPrice, invoice.currency)}
                </td>
                <td className="py-2 text-right tabular-nums text-foreground/60">
                  {line.vatRate.toFixed(0)}%
                </td>
                <td className="py-2 text-right tabular-nums font-extrabold">
                  {line.itemType === "discount" ? "−" : ""}
                  {formatMoney(line.lineTotal, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <dl className="grid w-72 gap-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-foreground/55">Subtotal</dt>
              <dd className="tabular-nums">
                {formatMoney(invoice.subtotalNet, invoice.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/55">Discounts</dt>
              <dd className="tabular-nums">
                −{formatMoney(invoice.discountTotal, invoice.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/55">
                VAT ({vatTreatmentLabel(invoice.vatTreatment)})
              </dt>
              <dd className="tabular-nums">
                {formatMoney(invoice.vatTotal, invoice.currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-[#0f150f] pt-2">
              <dt className="font-extrabold">Total</dt>
              <dd className="font-extrabold tabular-nums">
                {formatMoney(invoice.total, invoice.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/55">Payments received</dt>
              <dd className="tabular-nums">
                {formatMoney(invoice.amountPaid, invoice.currency)}
              </dd>
            </div>
            {invoice.creditedTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-foreground/55">Credit notes</dt>
                <dd className="tabular-nums">
                  −{formatMoney(invoice.creditedTotal, invoice.currency)}
                </dd>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between rounded-md bg-[#f6efdc] px-3 py-2">
              <dt className="font-extrabold">Balance due</dt>
              <dd className="font-extrabold tabular-nums">
                {formatMoney(invoice.balance, invoice.currency)}
              </dd>
            </div>
          </dl>
        </div>

        {invoice.payments.length ? (
          <section>
            <p className="mb-2 font-extrabold uppercase tracking-wider text-foreground/50">
              Payment history
            </p>
            <ul className="text-xs">
              {invoice.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex justify-between border-b border-foreground/15 py-1.5"
                >
                  <span>
                    {formatDate(payment.paidAt)} · {paymentMethodLabel(payment.method)}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </span>
                  <span className="tabular-nums font-extrabold">
                    {payment.amount < 0 ? "−" : ""}
                    {formatMoney(Math.abs(payment.amount), invoice.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {invoice.notes ? (
          <section className="text-xs">
            <p className="font-extrabold uppercase tracking-wider text-foreground/50">
              Notes
            </p>
            <p className="mt-1 whitespace-pre-line">{invoice.notes}</p>
          </section>
        ) : null}

        {invoice.terms ? (
          <section className="text-[10px] leading-4 text-foreground/60">
            <p className="font-extrabold uppercase tracking-wider text-foreground/50">
              Terms
            </p>
            <p className="mt-1 whitespace-pre-line">{invoice.terms}</p>
          </section>
        ) : null}

        <footer className="border-t pt-4 text-[10px] text-foreground/50">
          Generated by MOTOR.OS · {invoice.invoiceNumber}
        </footer>
      </div>
    </div>
  );
}
