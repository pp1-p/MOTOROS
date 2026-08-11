import { describe, expect, it } from "vitest";

import {
  DEFAULT_REPRESENTATIVE_APR,
  calculateFinance,
  estimatePcpBalloon,
} from "./finance";

describe("calculateFinance", () => {
  it("computes a plain HP monthly for a 10k car with 1k deposit at 9.9% over 48 months", () => {
    const quote = calculateFinance({
      cashPrice: 10_000,
      deposit: 1_000,
      termMonths: 48,
      apr: 9.9,
      type: "hp",
    });
    // Independent check: PMT(9.9%/12, 48, -9000) ≈ 227.83
    expect(quote.monthlyPayment).toBeCloseTo(227.83, 1);
    expect(quote.amountFinanced).toBe(9_000);
    expect(quote.balloon).toBe(0);
    expect(quote.totalPayable).toBeCloseTo(1_000 + 227.83 * 48, 0);
  });

  it("collapses to interest-free when APR is zero", () => {
    const quote = calculateFinance({
      cashPrice: 12_000,
      deposit: 2_000,
      termMonths: 40,
      apr: 0,
      type: "hp",
    });
    expect(quote.monthlyPayment).toBe(250); // 10,000 / 40
    expect(quote.totalPayable).toBe(12_000);
    expect(quote.totalInterest).toBe(0);
  });

  it("PCP payments are lower than HP because the balloon defers principal", () => {
    const base = {
      cashPrice: 20_000,
      deposit: 2_000,
      termMonths: 48,
      apr: DEFAULT_REPRESENTATIVE_APR,
    } as const;
    const hp = calculateFinance({ ...base, type: "hp" });
    const pcp = calculateFinance({ ...base, type: "pcp" });
    expect(pcp.monthlyPayment).toBeLessThan(hp.monthlyPayment);
    expect(pcp.balloon).toBeGreaterThan(0);
  });

  it("caps deposit at cash price and never returns a negative monthly", () => {
    const quote = calculateFinance({
      cashPrice: 5_000,
      deposit: 9_999,
      termMonths: 36,
      apr: 12.9,
      type: "hp",
    });
    expect(quote.amountFinanced).toBe(0);
    expect(quote.monthlyPayment).toBe(0);
    expect(quote.totalInterest).toBe(0);
  });

  it("floors term to at least one month", () => {
    const quote = calculateFinance({
      cashPrice: 6_000,
      deposit: 0,
      termMonths: 0,
      apr: 10,
      type: "hp",
    });
    expect(quote.termMonths).toBe(1);
    expect(quote.monthlyPayment).toBeGreaterThan(0);
  });
});

describe("estimatePcpBalloon", () => {
  it("shrinks the balloon percentage as the term lengthens", () => {
    const price = 20_000;
    const twoYear = estimatePcpBalloon(price, 24);
    const threeYear = estimatePcpBalloon(price, 36);
    const fourYear = estimatePcpBalloon(price, 48);
    const fiveYear = estimatePcpBalloon(price, 60);
    expect(twoYear).toBeGreaterThan(threeYear);
    expect(threeYear).toBeGreaterThan(fourYear);
    expect(fourYear).toBeGreaterThan(fiveYear);
  });

  it("returns zero for a nil or negative price", () => {
    expect(estimatePcpBalloon(0, 48)).toBe(0);
    expect(estimatePcpBalloon(-1, 48)).toBe(0);
  });
});
