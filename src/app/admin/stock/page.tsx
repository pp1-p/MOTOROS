import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";

import { PageHeader } from "@/components/admin/page-kit";
import { StockTable } from "@/components/admin/stock-table";
import { Button } from "@/components/ui/button";
import { getAdminVehicleInventory } from "@/lib/data/admin-vehicles";

export default async function StockPage() {
  const { vehicles, canViewCommercial } = await getAdminVehicleInventory();
  const activeVehicles = vehicles.filter(
    (vehicle) => !["Sold", "Returned", "Archived"].includes(vehicle.status),
  );
  const retailValue = activeVehicles.reduce(
    (total, vehicle) => total + vehicle.price,
    0,
  );
  const estimatedMargin = activeVehicles.reduce(
    (total, vehicle) => total + vehicle.price - vehicle.cost,
    0,
  );
  const averageAge = activeVehicles.length
    ? Math.round(
        activeVehicles.reduce((total, vehicle) => total + vehicle.age, 0) /
          activeVehicles.length,
      )
    : 0;
  const compactCurrency = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
    notation: "compact",
  });
  return (
    <div className="min-w-0 max-w-[calc(100dvw-2rem)] space-y-6 sm:max-w-full">
      <PageHeader
        eyebrow="Vehicle operations"
        title="Stock"
        description="Manage acquisition, preparation, pricing and presentation across your vehicle inventory."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/stock/advertising">
                <Megaphone />
                Advertising
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/stock/new">
                <Plus />
                Add vehicle
              </Link>
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [String(activeVehicles.length), "Active stock"],
          [compactCurrency.format(retailValue), "Retail value"],
          ...(canViewCommercial
            ? [[compactCurrency.format(estimatedMargin), "Est. margin"]]
            : []),
          [`${averageAge} days`, "Average age"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl border bg-white p-3.5">
            <p className="text-lg font-extrabold tracking-[-0.03em]">{value}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-foreground/45">{label}</p>
          </div>
        ))}
      </div>
      <StockTable
        vehicles={vehicles}
        canViewCommercial={canViewCommercial}
      />
    </div>
  );
}
