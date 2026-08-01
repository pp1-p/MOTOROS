import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/admin/page-kit";
import { SaleDetailsEditForm } from "@/components/admin/sale-details-edit-form";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/permissions";
import { getInvoiceById } from "@/lib/data/admin-invoices";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit sale details",
};

export default async function EditSaleInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("invoices:manage");
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();
  if (invoice.type !== "vehicle_sale") {
    redirect(`/admin/invoices/${invoice.id}`);
  }
  if (invoice.status === "cancelled" || invoice.status === "void") {
    redirect(`/admin/invoices/${invoice.id}`);
  }

  const details = invoice.saleDetails;
  const px = details?.partExchange;
  const initial = {
    warranty_terms: details?.warrantyTerms ?? "",
    payment_method_note: details?.paymentMethodNote ?? "",
    part_exchange_description: px?.description ?? "",
    part_exchange_allowance:
      px?.allowance !== null && px?.allowance !== undefined
        ? String(px.allowance)
        : "",
    part_exchange_registration: px?.registration ?? "",
    part_exchange_mileage:
      px?.mileage !== null && px?.mileage !== undefined
        ? String(px.mileage)
        : "",
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vehicle sale"
        title={`Edit sale details · ${invoice.invoiceNumber}`}
        description="Update warranty terms, payment method notes and part-exchange summary. Totals, VAT, deposit and line items are locked here."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/invoices/${invoice.id}`}>
              <ArrowLeft />
              Invoice
            </Link>
          </Button>
        }
      />
      <SaleDetailsEditForm invoiceId={invoice.id} initial={initial} />
    </div>
  );
}
