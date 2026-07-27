import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  GeneralInvoiceForm,
  type GeneralInvoiceFormInitial,
} from "@/components/admin/general-invoice-form";
import { PageHeader } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/permissions";
import {
  getGeneralInvoiceFormOptions,
  getInvoiceById,
} from "@/lib/data/admin-invoices";

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export default async function EditGeneralInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("invoices:manage");
  const { id } = await params;
  const [invoice, options] = await Promise.all([
    getInvoiceById(id),
    getGeneralInvoiceFormOptions(),
  ]);
  if (!invoice) notFound();
  if (!["general", "pro_forma", "vat"].includes(invoice.type)) {
    redirect(`/admin/invoices/${invoice.id}`);
  }

  const initial: GeneralInvoiceFormInitial = {
    id: invoice.id,
    title: invoice.title ?? invoice.invoiceNumber,
    status: invoice.status === "draft" ? "draft" : "sent",
    customerId: invoice.customerId ?? "",
    vehicleId: invoice.vehicleId ?? "",
    issuedDate: dateInput(invoice.issuedAt ?? invoice.createdAt),
    dueDate: dateInput(invoice.dueAt),
    vatTreatment: invoice.vatTreatment,
    showVat: invoice.showVat,
    showPaymentDetails: invoice.showPaymentDetails,
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
    lines: invoice.lineItems.map((line) => ({
      key: line.id,
      itemType: line.itemType,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatRate: line.vatRate,
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title={`Edit ${invoice.invoiceNumber}`}
        description="Update invoice details and itemised charges. Paid or credited invoices are locked."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/invoices/${invoice.id}`}>
              <ArrowLeft />
              Invoice
            </Link>
          </Button>
        }
      />
      <GeneralInvoiceForm
        customers={options.customers}
        vehicles={options.vehicles}
        initial={initial}
      />
    </div>
  );
}
