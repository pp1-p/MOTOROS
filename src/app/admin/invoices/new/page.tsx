import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";

import { GeneralInvoiceForm } from "@/components/admin/general-invoice-form";
import { PageHeader } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/permissions";
import { getGeneralInvoiceFormOptions } from "@/lib/data/admin-invoices";

export default async function NewGeneralInvoicePage() {
  await requireStaff("invoices:manage");
  const options = await getGeneralInvoiceFormOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="New general invoice"
        description="Raise an itemised invoice for dealership work, products or fees."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/invoices">
              <ArrowLeft />
              All invoices
            </Link>
          </Button>
        }
      />
      <div className="flex items-start gap-3 rounded-2xl border border-brand/20 bg-brand-soft/45 p-4 text-xs text-foreground/65">
        <ReceiptText className="mt-0.5 size-4 shrink-0 text-brand" />
        <p>
          Use sale and repair records for their linked invoices. This page is for
          standalone charges such as preparation, accessories, transport or other
          dealership services.
        </p>
      </div>
      <GeneralInvoiceForm
        customers={options.customers}
        vehicles={options.vehicles}
      />
    </div>
  );
}
