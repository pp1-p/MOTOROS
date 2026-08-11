// Finance quote maths for the public illustrative calculator.
//
// Pure functions — no side effects, no third-party dependencies — so the
// same formulas can run server-side (SEO / structured data), client-side
// (live widget) or in tests. All figures are illustrative: a real finance
// application returns lender-underwritten APR and PCP guaranteed future
// value (GFV) based on mileage, condition and vehicle age.

export type FinanceType = "hp" | "pcp";

export type FinanceInputs = {
  cashPrice: number;
  deposit: number;
  termMonths: number;
  /** Annual percentage rate, expressed as a number: 9.9 means 9.9%. */
  apr: number;
  type: FinanceType;
  /**
   * PCP optional final payment (Guaranteed Future Value). Omit to let the
   * calculator use its rough term-based ballpark.
   */
  balloon?: number;
};

export type FinanceQuote = {
  type: FinanceType;
  /** Monthly payment, rounded to the nearest penny. */
  monthlyPayment: number;
  /** deposit + monthly * term + balloon. */
  totalPayable: number;
  /** totalPayable - cashPrice. */
  totalInterest: number;
  amountFinanced: number;
  balloon: number;
  representativeApr: number;
  termMonths: number;
};

/**
 * Standard amortization payment where a loan of `principal` is paid down
 * to `balloon` over `termMonths` at a periodic (monthly) rate `monthlyRate`.
 *
 *   m = (P * (1+r)^n - B) * r / ((1+r)^n - 1)
 */
function periodicPayment(
  principal: number,
  monthlyRate: number,
  termMonths: number,
  balloon: number,
): number {
  if (termMonths <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) {
    return Math.max(0, (principal - balloon) / termMonths);
  }
  const pow = Math.pow(1 + monthlyRate, termMonths);
  return ((principal * pow - balloon) * monthlyRate) / (pow - 1);
}

/**
 * Rough PCP Guaranteed Future Value: percentage of cash price that keeps
 * shrinking as the term lengthens. This is only for the illustrative
 * monthly figure — real GFV comes from the lender based on the
 * make/model/mileage.
 */
export function estimatePcpBalloon(cashPrice: number, termMonths: number): number {
  if (cashPrice <= 0) return 0;
  const bracket =
    termMonths <= 24
      ? 0.45
      : termMonths <= 36
        ? 0.4
        : termMonths <= 48
          ? 0.35
          : 0.3;
  return cashPrice * bracket;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateFinance(inputs: FinanceInputs): FinanceQuote {
  const cashPrice = Math.max(0, inputs.cashPrice);
  const deposit = Math.max(0, Math.min(inputs.deposit, cashPrice));
  const termMonths = Math.max(1, Math.floor(inputs.termMonths));
  const apr = Math.max(0, inputs.apr);
  const monthlyRate = apr / 100 / 12;
  const amountFinanced = cashPrice - deposit;
  const balloon =
    inputs.type === "pcp"
      ? (inputs.balloon ?? estimatePcpBalloon(cashPrice, termMonths))
      : 0;
  const monthly = periodicPayment(
    amountFinanced,
    monthlyRate,
    termMonths,
    balloon,
  );
  const totalPayable = deposit + monthly * termMonths + balloon;
  const totalInterest = Math.max(0, totalPayable - cashPrice);
  return {
    type: inputs.type,
    monthlyPayment: round2(monthly),
    totalPayable: round2(totalPayable),
    totalInterest: round2(totalInterest),
    amountFinanced: round2(amountFinanced),
    balloon: round2(balloon),
    representativeApr: apr,
    termMonths,
  };
}

/** Default representative APR shown to the customer before they change it. */
export const DEFAULT_REPRESENTATIVE_APR = 12.9;
/** Term options offered in the widget. */
export const DEFAULT_TERM_OPTIONS = [24, 36, 48, 60] as const;
export const DEFAULT_TERM_MONTHS = 48;
