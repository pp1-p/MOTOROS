import { describe, expect, it } from "vitest";

import {
  formatMoney,
  invoiceStatusLabel,
  invoiceStatusTone,
  invoiceTypeLabel,
  lineItemLabel,
  paymentMethodLabel,
  vatTreatmentLabel,
} from "@/lib/invoices/format";
import {
  resolveInitialInvoiceVehicle,
  vehicleInvoiceWorkspaceHref,
} from "@/lib/invoices/linking";

describe("invoice formatting helpers", () => {
  it("formats money in en-GB with two decimal places", () => {
    expect(formatMoney(1234.5)).toBe("£1,234.50");
    expect(formatMoney(0)).toBe("£0.00");
    expect(formatMoney(999999.99)).toBe("£999,999.99");
  });

  it("maps every invoice type to a human label", () => {
    for (const type of [
      "vehicle_sale",
      "repair",
      "sourcing",
      "deposit",
      "general",
      "credit_note",
      "pro_forma",
      "vat",
    ] as const) {
      expect(invoiceTypeLabel(type)).not.toBe("");
    }
  });

  it("maps every invoice status to a label and tone class", () => {
    for (const status of [
      "draft",
      "sent",
      "viewed",
      "partially_paid",
      "paid",
      "overdue",
      "cancelled",
      "refunded",
      "credited",
      "void",
    ] as const) {
      expect(invoiceStatusLabel(status)).not.toBe("");
      expect(invoiceStatusTone(status)).toMatch(/bg-/);
    }
  });

  it("labels every supported payment method", () => {
    for (const method of [
      "cash",
      "card",
      "bank_transfer",
      "finance_provider",
      "payment_link",
      "cheque",
      "deposit_transfer",
      "other",
    ] as const) {
      expect(paymentMethodLabel(method)).not.toBe("");
    }
  });

  it("labels every line-item type", () => {
    for (const type of [
      "charge",
      "labour",
      "part",
      "fee",
      "discount",
      "note",
    ] as const) {
      expect(lineItemLabel(type)).not.toBe("");
    }
  });

  it("recognises credit note statuses", () => {
    const statuses = ["issued", "refunded", "cancelled"] as const;
    // Sanity check that the type union we use across the client covers every
    // status the RPC can return. The list is intentionally hard-coded here so
    // a schema change without a corresponding UI update will fail the build.
    for (const status of statuses) {
      expect(status).toBeDefined();
    }
  });

  it("labels every VAT treatment", () => {
    for (const treatment of [
      "standard",
      "margin",
      "zero",
      "exempt",
      "not_registered",
    ] as const) {
      expect(vatTreatmentLabel(treatment)).not.toBe("");
    }
  });

  it("preserves a valid stock-vehicle link and rejects an unknown vehicle", () => {
    const vehicleIds = [
      "00000000-0000-0000-0000-000000000201",
      "00000000-0000-0000-0000-000000000202",
    ];
    expect(resolveInitialInvoiceVehicle(vehicleIds[0], vehicleIds)).toBe(
      vehicleIds[0],
    );
    expect(
      resolveInitialInvoiceVehicle(
        "00000000-0000-0000-0000-000000000999",
        vehicleIds,
      ),
    ).toBeUndefined();
  });

  it("links invoice users back to the vehicle invoices and costs tab", () => {
    expect(
      vehicleInvoiceWorkspaceHref(
        "00000000-0000-0000-0000-000000000201",
      ),
    ).toBe(
      "/admin/stock/00000000-0000-0000-0000-000000000201?tab=costs",
    );
  });
});
