import type { AdminVehicle } from "./admin-data";

export type StockSort = "stock-number" | "age" | "price-low" | "price-high";

export function filterAndSortStock(
  vehicles: AdminVehicle[],
  query: string,
  status: string,
  sort: StockSort,
) {
  const term = query.trim().toLowerCase();
  return vehicles
    .filter((vehicle) => {
      const matchesQuery = `${vehicle.registration} ${vehicle.stockNumber} ${vehicle.title}`
        .toLowerCase()
        .includes(term);
      const matchesStatus = status === "All active stock"
        ? !["Sold", "Returned", "Archived"].includes(vehicle.status)
        : status === "All stock"
          ? true
          : status === "Available"
            ? vehicle.status === "On forecourt"
            : vehicle.status === status;
      return matchesQuery && matchesStatus;
    })
    .sort((a, b) => {
      const difference = sort === "age"
        ? b.age - a.age
        : sort === "price-low"
          ? a.price - b.price
          : sort === "price-high"
            ? b.price - a.price
            : a.stockNumber.localeCompare(b.stockNumber, "en-GB", { numeric: true });
      return difference || a.id.localeCompare(b.id);
    });
}
