import { describe, expect, it } from "vitest";

import {
  buildFinanceEnquiryHref,
  effectiveFinanceDeposit,
  financeCalculatorMessage,
  parseFinanceEnquiryPrefill,
} from "./finance-handoff";

describe("finance enquiry handoff", () => {
  it("carries the complete calculator quote into the finance URL", () => {
    const href = buildFinanceEnquiryHref({
      vehicleReference: "2021 Audi A3 · AB21 CDE",
      monthlyPayment: 327.62,
      deposit: 2_000,
      cashPrice: 18_500,
      termMonths: 48,
      productType: "pcp",
      apr: 9.9,
    });

    const url = new URL(href, "https://motor.os");
    expect(url.pathname).toBe("/finance");
    expect(url.searchParams.get("vehicle")).toBe("2021 Audi A3 · AB21 CDE");
    expect(url.searchParams.get("monthly")).toBe("328");
    expect(url.searchParams.get("deposit")).toBe("2000");
    expect(url.searchParams.get("term")).toBe("48");
    expect(url.searchParams.get("type")).toBe("pcp");
    expect(url.searchParams.get("apr")).toBe("9.9");
  });

  it("uses the same capped deposit in the handoff as the finance calculation", () => {
    expect(effectiveFinanceDeposit(5_000, 9_999)).toBe(5_000);

    const url = new URL(
      buildFinanceEnquiryHref({
        monthlyPayment: 0,
        deposit: 9_999,
        cashPrice: 5_000,
        termMonths: 36,
        productType: "hp",
        apr: 12.9,
      }),
      "https://motor.os",
    );

    expect(url.searchParams.get("deposit")).toBe("5000");
  });

  it("parses calculator values into enquiry-form values including APR", () => {
    const prefill = parseFinanceEnquiryPrefill(
      new URLSearchParams(
        "vehicle=VW+Golf&monthly=249&deposit=1500&term=48&type=hp&apr=12.9",
      ),
    );

    expect(prefill).toEqual({
      budgetMonthly: "£249",
      deposit: "£1500",
      term: "48",
      vehicleOfInterest: "VW Golf",
      product: "Hire Purchase",
      apr: "12.9",
      hasAnyPrefill: true,
    });
    expect(financeCalculatorMessage(prefill)).toBe(
      "From the online calculator: Hire Purchase illustration at 12.9% APR.",
    );
  });

  it("rejects malformed handoff values rather than trusting the query string", () => {
    const prefill = parseFinanceEnquiryPrefill(
      new URLSearchParams(
        "monthly=abc&deposit=-25&term=120&type=lease&apr=99.9",
      ),
    );

    expect(prefill.budgetMonthly).toBe("");
    expect(prefill.deposit).toBe("");
    expect(prefill.term).toBe("unsure");
    expect(prefill.product).toBeNull();
    expect(prefill.apr).toBeNull();
  });
});
