import { describe, expect, it } from "vitest";
import { calculateInvoicePreview } from "./totals";
const charge = { itemType: "charge", quantity: 1, unitPrice: 10.03, vatRate: 20 };
describe("invoice preview matches persisted per-line rounding", () => {
  it("rounds VAT on each line before adding it", () => {
    expect(calculateInvoicePreview([charge, charge], true)).toEqual({ subtotal: 20.06, discount: 0, vat: 4.02, total: 24.08 });
  });
  it("rounds stored quantity and price before computing line net", () => {
    expect(calculateInvoicePreview([{ ...charge, quantity: 1.234, unitPrice: 19.995 }], true)).toEqual({ subtotal: 24.6, discount: 0, vat: 4.92, total: 29.52 });
  });
  it("does not charge notes or VAT on discounts", () => {
    expect(calculateInvoicePreview([charge, { ...charge, itemType: "note", unitPrice: 999 }, { ...charge, itemType: "discount", unitPrice: 2 }], true)).toEqual({ subtotal: 10.03, discount: 2, vat: 2.01, total: 10.04 });
  });
  it("respects disabled VAT and floors an over-discounted total", () => {
    expect(calculateInvoicePreview([charge], false).total).toBe(10.03);
    expect(calculateInvoicePreview([charge, { ...charge, itemType: "discount", unitPrice: 20 }], false).total).toBe(0);
  });
});
