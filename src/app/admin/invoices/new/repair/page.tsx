import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/admin/page-kit";
import { RepairInvoiceForm } from "@/components/admin/repair-invoice-form";
import { Button } from "@/components/ui/button";
import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getGeneralInvoiceFormOptions } from "@/lib/data/admin-invoices";
import { getRepairCodes } from "@/lib/data/admin-repair-codes";
import { resolveInitialInvoiceVehicle } from "@/lib/invoices/linking";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New repair invoice",
};

export default async function NewRepairInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string; customer?: string }>;
}) {
  const staff = await getStaffContext();
  if (!staff) redirect("/admin/sign-in");
  if (!hasPermission(staff.role, "invoices:manage")) {
    redirect("/admin/invoices");
  }

  const [{ vehicle, customer }, options, repairCodes] = await Promise.all([
    searchParams,
    getGeneralInvoiceFormOptions(),
    getRepairCodes({ includeInactive: false }),
  ]);
  const initialVehicleId = resolveInitialInvoiceVehicle(
    vehicle,
    options.vehicles.map((item) => item.id),
  );
  const initialCustomerId =
    customer && options.customers.some((c) => c.id === customer)
      ? customer
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Invoicing"
        title="New repair invoice"
        description="Raise a repair invoice with reusable codes, categorised line items and the workshop narrative your customer expects."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/invoices">
              <ArrowLeft />
              All invoices
            </Link>
          </Button>
        }
      />
      <RepairInvoiceForm
        customers={options.customers}
        vehicles={options.vehicles}
        repairCodes={repairCodes}
        initialVehicleId={initialVehicleId}
        initialCustomerId={initialCustomerId}
      />
    </div>
  );
}
