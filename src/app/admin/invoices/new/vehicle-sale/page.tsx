import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/admin/page-kit";
import { VehicleSaleInvoiceForm } from "@/components/admin/vehicle-sale-invoice-form";
import { Button } from "@/components/ui/button";
import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getGeneralInvoiceFormOptions } from "@/lib/data/admin-invoices";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New vehicle sale invoice",
};

export default async function NewVehicleSaleInvoicePage() {
  const staff = await getStaffContext();
  if (!staff) redirect("/admin/sign-in");
  if (!hasPermission(staff.role, "invoices:manage")) {
    redirect("/admin/invoices");
  }

  const options = await getGeneralInvoiceFormOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Invoicing"
        title="New vehicle sale invoice"
        description="Raise a full vehicle sale invoice with deposit, part-exchange, fees and warranty terms in one place."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/invoices">
              <ArrowLeft />
              All invoices
            </Link>
          </Button>
        }
      />
      <VehicleSaleInvoiceForm
        customers={options.customers}
        vehicles={options.vehicles}
      />
    </div>
  );
}
