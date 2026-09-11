import type { FinanceType } from "./finance";

export type FinanceEnquiryTerm = "24" | "36" | "48" | "60" | "unsure";

export type FinanceEnquiryPrefill = {
  budgetMonthly: string;
  deposit: string;
  term: FinanceEnquiryTerm;
  vehicleOfInterest: string;
  product: "Hire Purchase" | "PCP" | null;
  apr: string | null;
  hasAnyPrefill: boolean;
};

const allowedTerms = new Set<FinanceEnquiryTerm>(["24", "36", "48", "60"]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function toIntegerString(raw: string | null, allowZero = false): string {
  if (!raw) return "";
  const normalised = raw.trim().replace(/^£/, "").replaceAll(",", "");
  if (!/^\d+$/.test(normalised)) return "";
  const parsed = Number.parseInt(normalised, 10);
  if (!Number.isFinite(parsed)) return "";
  if (allowZero ? parsed < 0 : parsed <= 0) return "";
  return String(parsed);
}

function toAprString(raw: string | null): string | null {
  if (!raw) return null;
  const normalised = raw.trim().replace(/%$/, "");
  if (!/^\d+(?:\.\d+)?$/.test(normalised)) return null;
  const parsed = Number.parseFloat(normalised);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 24.9) return null;
  return parsed.toFixed(1);
}

export function effectiveFinanceDeposit(cashPrice: number, deposit: number): number {
  return clamp(
    Number.isFinite(deposit) ? deposit : 0,
    0,
    Math.max(0, Number.isFinite(cashPrice) ? cashPrice : 0),
  );
}

export function buildFinanceEnquiryHref({
  vehicleReference,
  monthlyPayment,
  deposit,
  cashPrice,
  termMonths,
  productType,
  apr,
}: {
  vehicleReference?: string;
  monthlyPayment: number;
  deposit: number;
  cashPrice: number;
  termMonths: number;
  productType: FinanceType;
  apr: number;
}): string {
  const params = new URLSearchParams();
  const vehicle = vehicleReference?.trim();
  const effectiveDeposit = effectiveFinanceDeposit(cashPrice, deposit);
  const safeApr = clamp(Number.isFinite(apr) ? apr : 0, 0, 24.9);

  if (vehicle) params.set("vehicle", vehicle);
  params.set("monthly", String(Math.max(0, Math.round(monthlyPayment))));
  params.set("deposit", String(Math.round(effectiveDeposit)));
  params.set("term", String(termMonths));
  params.set("type", productType);
  params.set("apr", safeApr.toFixed(1));

  return `/finance?${params.toString()}`;
}

export function parseFinanceEnquiryPrefill(
  searchParams: Pick<URLSearchParams, "get">,
): FinanceEnquiryPrefill {
  const monthly = toIntegerString(searchParams.get("monthly"));
  const deposit = toIntegerString(searchParams.get("deposit"), true);
  const rawTerm = searchParams.get("term")?.trim() ?? "";
  const term = allowedTerms.has(rawTerm as FinanceEnquiryTerm)
    ? (rawTerm as FinanceEnquiryTerm)
    : "unsure";
  const productParam = searchParams.get("type")?.trim().toLowerCase() ?? "";
  const product =
    productParam === "pcp"
      ? "PCP"
      : productParam === "hp"
        ? "Hire Purchase"
        : null;
  const vehicle = searchParams.get("vehicle")?.trim() ?? "";
  const apr = toAprString(searchParams.get("apr"));

  return {
    budgetMonthly: monthly ? `£${monthly}` : "",
    deposit: deposit ? `£${deposit}` : deposit === "0" ? "£0" : "",
    term,
    vehicleOfInterest: vehicle,
    product,
    apr,
    hasAnyPrefill: Boolean(
      monthly ||
        deposit ||
        vehicle ||
        rawTerm ||
        productParam ||
        searchParams.get("apr"),
    ),
  };
}

export function financeCalculatorMessage(prefill: FinanceEnquiryPrefill): string {
  if (!prefill.product) return "";
  return prefill.apr
    ? `From the online calculator: ${prefill.product} illustration at ${prefill.apr}% APR.`
    : `From the online calculator: ${prefill.product} illustration.`;
}
