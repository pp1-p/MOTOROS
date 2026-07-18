import { describe, expect, it } from "vitest";

import {
  commercialSaleDetailSelect,
  getSaleDetailSelect,
  operationalSaleDetailSelect,
} from "@/lib/auth/sales-access";

describe("sale detail field access", () => {
  it("does not request management-only fields for operational users", () => {
    expect(operationalSaleDetailSelect).not.toContain("internal_notes");
    expect(operationalSaleDetailSelect).not.toContain("gross_profit");
    expect(operationalSaleDetailSelect).not.toContain("finance_referral_");
    expect(operationalSaleDetailSelect).not.toContain("completion_checklist");
    expect(getSaleDetailSelect(false)).toBe(operationalSaleDetailSelect);
  });

  it("requests the two displayed management fields only with permission", () => {
    expect(commercialSaleDetailSelect).toContain("internal_notes");
    expect(commercialSaleDetailSelect).toContain("gross_profit");
    expect(getSaleDetailSelect(true)).toBe(commercialSaleDetailSelect);
  });
});
