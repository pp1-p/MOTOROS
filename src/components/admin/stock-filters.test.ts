import { describe, expect, it } from "vitest";
import type { AdminVehicle } from "./admin-data";
import { filterAndSortStock } from "./stock-filters";

function vehicle(id: string, overrides: Partial<AdminVehicle> = {}): AdminVehicle {
  return { id, stockNumber: "ST-" + id, registration: "AB12CDE", title: "Ford Focus", year: 2020,
    mileage: 20_000, price: 12_000, cost: 9_000, age: 5, image: "", status: "On forecourt", ...overrides };
}

describe("stock filters", () => {
  const vehicles = [vehicle("2"), vehicle("10", { price: 18_000, age: 60 }),
    vehicle("3", { status: "Sold", price: 8_000 }), vehicle("4", { status: "Returned" }),
    vehicle("5", { status: "Archived" }), vehicle("6", { status: "Reserved" })];
  it("excludes inactive records from active stock without mutating input", () => {
    const result = filterAndSortStock(vehicles, "", "All active stock", "stock-number");
    expect(result.map(v => v.id)).toEqual(["2", "6", "10"]);
    expect(vehicles.map(v => v.id)).toEqual(["2", "10", "3", "4", "5", "6"]);
  });
  it("keeps sold, returned and archived stock explicitly accessible", () => {
    expect(filterAndSortStock(vehicles, "", "All stock", "stock-number")).toHaveLength(6);
    expect(filterAndSortStock(vehicles, "", "Sold", "stock-number").map(v => v.id)).toEqual(["3"]);
    expect(filterAndSortStock(vehicles, "", "Archived", "stock-number").map(v => v.id)).toEqual(["5"]);
  });
  it("matches registration, stock number and model case-insensitively", () => {
    expect(filterAndSortStock(vehicles, "  ab12cde ", "Available", "stock-number")).toHaveLength(2);
    expect(filterAndSortStock(vehicles, "st-10", "All stock", "stock-number")[0]?.id).toBe("10");
    expect(filterAndSortStock(vehicles, "focus", "Reserved", "stock-number")[0]?.id).toBe("6");
    expect(filterAndSortStock(vehicles, "no match", "All stock", "stock-number")).toEqual([]);
  });
  it("sorts prices and age, with deterministic tie-breaking", () => {
    expect(filterAndSortStock(vehicles, "", "All stock", "price-low")[0]?.id).toBe("3");
    expect(filterAndSortStock(vehicles, "", "All stock", "price-high")[0]?.id).toBe("10");
    expect(filterAndSortStock(vehicles, "", "All active stock", "age")[0]?.id).toBe("10");
  });
});
