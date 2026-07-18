import { notFound } from "next/navigation";

import { VehicleWorkspace } from "@/components/admin/vehicle-workspace";
import { getAdminVehicleInventory } from "@/lib/data/admin-vehicles";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { vehicles, photosByVehicle, historyByVehicle, canViewCommercial } =
    await getAdminVehicleInventory();
  const vehicle = vehicles.find((item) => item.id === id);
  if (!vehicle) notFound();

  return (
    <VehicleWorkspace
      vehicle={vehicle}
      initialPhotos={photosByVehicle[vehicle.id] ?? []}
      initialHistory={historyByVehicle[vehicle.id] ?? []}
      canViewCommercial={canViewCommercial}
    />
  );
}
