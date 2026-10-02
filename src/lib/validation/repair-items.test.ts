import { describe, expect, it } from "vitest";
import { createRepairItemSchema } from "./repair-items";
const valid = {
  id: "00000000-0000-4000-8000-000000000001",
  itemType: "part",
  description: "Oil filter",
  quantity: 1,
  unitPrice: 12.34,
  vatRate: 20,
  status: "planned",
  changeReason: "Agreed service",
};
describe("repair item validation", () => {
  it("accepts form decimals and optional part metadata", () => {
    expect(
      createRepairItemSchema.parse({
        ...valid,
        quantity: "1.5",
        supplier: "  Workshop supplier  ",
        partNumber: " ",
      }),
    ).toMatchObject({
      quantity: 1.5,
      supplier: "Workshop supplier",
      partNumber: null,
    });
  });
  it.each([
    { quantity: 0 },
    { quantity: -1 },
    { quantity: "" },
    { unitPrice: null },
    { unitPrice: -1 },
    { unitPrice: 0.001 },
    { vatRate: 101 },
    { vatRate: "NaN" },
    { status: "cancelled" },
    { itemType: "discount" },
    { changeReason: "" },
  ])("rejects invalid amounts/status/reasons: %j", (changes) => {
    expect(
      createRepairItemSchema.safeParse({ ...valid, ...changes }).success,
    ).toBe(false);
  });
});
