import { notFound } from "next/navigation";

import { VehicleWorkspace } from "@/components/admin/vehicle-workspace";
import {
  getAdminVehicleInventory,
  getVehicleWorkspaceData,
} from "@/lib/data/admin-vehicles";

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const {
    vehicles,
    photosByVehicle,
    historyByVehicle,
    canViewCommercial,
    canViewInvoices,
    canManageInvoices,
  } =
    await getAdminVehicleInventory();
  const vehicle = vehicles.find((item) => item.id === id);
  if (!vehicle) notFound();
  const workspaceData = await getVehicleWorkspaceData(vehicle.id);

  return (
    <VehicleWorkspace
      vehicle={vehicle}
      initialPhotos={photosByVehicle[vehicle.id] ?? []}
      initialHistory={historyByVehicle[vehicle.id] ?? []}
      canViewCommercial={canViewCommercial}
      canViewInvoices={canViewInvoices}
      canManageInvoices={canManageInvoices}
      initialTab={tab}
      workspaceData={workspaceData}
    />
  );
}
