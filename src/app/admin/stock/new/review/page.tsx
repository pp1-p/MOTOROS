import { Suspense } from "react";

import { PageHeader } from "@/components/admin/page-kit";
import { VehicleReviewForm } from "@/components/admin/vehicle-review-form";

export default function ReviewVehiclePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Stock acquisition"
        title="Review vehicle details"
        description="Confirm provider facts and complete the information that only your team can verify."
      />
      <Suspense fallback={<div className="min-h-80 rounded-2xl border bg-white" />}>
        <VehicleReviewForm />
      </Suspense>
    </div>
  );
}

