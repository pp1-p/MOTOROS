export function resolveInitialInvoiceVehicle(
  requestedVehicleId: string | undefined,
  vehicleIds: readonly string[],
) {
  if (!requestedVehicleId) return undefined;
  return vehicleIds.includes(requestedVehicleId)
    ? requestedVehicleId
    : undefined;
}

export function vehicleInvoiceWorkspaceHref(vehicleId: string) {
  return `/admin/stock/${encodeURIComponent(vehicleId)}?tab=costs`;
}
