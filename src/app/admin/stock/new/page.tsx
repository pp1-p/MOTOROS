import { PageHeader } from "@/components/admin/page-kit";
import { VehicleLookupForm } from "@/components/admin/vehicle-lookup-form";

import { requireStaff } from "@/lib/auth/permissions";

export default async function NewVehiclePage() {
  await requireStaff("stock:manage");
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Stock acquisition"
        title="Add a vehicle"
        description="Look up a UK registration or continue with safe manual entry."
      />
      <VehicleLookupForm />
    </div>
  );
}

