import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/admin/page-kit";
import { RepairNarrativeEditForm } from "@/components/admin/repair-narrative-edit-form";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth/permissions";
import { getInvoiceById } from "@/lib/data/admin-invoices";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit repair narrative",
};

export default async function EditRepairInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("invoices:manage");
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();
  if (invoice.type !== "repair") {
    redirect(`/admin/invoices/${invoice.id}`);
  }
  if (invoice.status === "cancelled" || invoice.status === "void") {
    redirect(`/admin/invoices/${invoice.id}`);
  }

  const details = invoice.repairDetails;
  const initial = {
    reported_fault: details?.reportedFault ?? "",
    diagnosis: details?.diagnosis ?? "",
    work_completed: details?.workCompleted ?? "",
    technician_notes: details?.technicianNotes ?? "",
    recommendations: details?.recommendations ?? "",
    warranty: details?.warranty ?? "",
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Repair invoice"
        title={`Edit narrative · ${invoice.invoiceNumber}`}
        description="Update the workshop narrative, notes and terms. Totals, VAT and line items are locked here."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/invoices/${invoice.id}`}>
              <ArrowLeft />
              Invoice
            </Link>
          </Button>
        }
      />
      <RepairNarrativeEditForm invoiceId={invoice.id} initial={initial} />
    </div>
  );
}
