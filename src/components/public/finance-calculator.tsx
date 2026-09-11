"use client";

import { Calculator } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { buildFinanceEnquiryHref } from "@/lib/finance-handoff";
import {
  DEFAULT_REPRESENTATIVE_APR,
  DEFAULT_TERM_MONTHS,
  DEFAULT_TERM_OPTIONS,
  calculateFinance,
  type FinanceType,
} from "@/lib/finance";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type FinanceCalculatorProps = {
  cashPrice: number;
  /** Compact = fits the car-detail sidebar. Full = inline block. */
  variant?: "compact" | "full";
  /**
   * Extra hidden inputs to pass into the enquiry form when the user
   * clicks "Get a personalised quote".
   */
  vehicleReference?: string;
  className?: string;
};

const monthlyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function toMoney(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function FinanceCalculator({
  cashPrice,
  variant = "compact",
  vehicleReference,
  className,
}: FinanceCalculatorProps) {
  const safeCashPrice = Math.max(0, Math.round(cashPrice));
  const defaultDeposit = Math.round(safeCashPrice * 0.1);
  const [type, setType] = useState<FinanceType>("hp");
  const [depositInput, setDepositInput] = useState<string>(
    String(defaultDeposit),
  );
  const [termMonths, setTermMonths] = useState<number>(DEFAULT_TERM_MONTHS);
  const [apr, setApr] = useState<number>(DEFAULT_REPRESENTATIVE_APR);

  const deposit = toMoney(depositInput);

  const quote = useMemo(
    () =>
      calculateFinance({
        cashPrice: safeCashPrice,
        deposit,
        termMonths,
        apr,
        type,
      }),
    [safeCashPrice, deposit, termMonths, apr, type],
  );

  const quoteHref = buildFinanceEnquiryHref({
    vehicleReference,
    monthlyPayment: quote.monthlyPayment,
    deposit,
    cashPrice: safeCashPrice,
    termMonths,
    productType: type,
    apr,
  });

  return (
    <div
      className={cn(
        "rounded-3xl border bg-white",
        variant === "compact" ? "p-5" : "p-6 sm:p-8",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Calculator className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.16em] text-brand uppercase">
            Finance from
          </p>
          <p className="text-2xl font-extrabold tabular-nums">
            {monthlyFormatter.format(quote.monthlyPayment)}
            <span className="ml-1 text-sm font-bold text-foreground/50">
              /month
            </span>
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <fieldset>
          <legend className="mb-1.5 block text-[11px] font-extrabold tracking-[0.14em] text-foreground/50 uppercase">
            Product
          </legend>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border p-1">
            {(["hp", "pcp"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                aria-pressed={type === option}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition",
                  type === option
                    ? "bg-brand text-white shadow-sm"
                    : "text-foreground/60 hover:bg-brand-soft/70",
                )}
              >
                {option === "hp" ? "Hire purchase" : "PCP"}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-extrabold tracking-[0.14em] text-foreground/50 uppercase">
            Deposit
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm font-bold text-foreground/45">
              £
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={depositInput}
              onChange={(event) => setDepositInput(event.target.value)}
              onBlur={() => setDepositInput(String(Math.min(deposit, safeCashPrice)))}
              className="h-11 w-full rounded-xl border bg-white pl-7 pr-3 text-sm font-bold tabular-nums focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              aria-label="Deposit amount in pounds"
            />
          </div>
        </label>

        <fieldset>
          <legend className="mb-1.5 block text-[11px] font-extrabold tracking-[0.14em] text-foreground/50 uppercase">
            Term
          </legend>
          <div className="grid grid-cols-4 gap-1.5 rounded-xl border p-1">
            {DEFAULT_TERM_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTermMonths(option)}
                aria-pressed={termMonths === option}
                className={cn(
                  "rounded-lg py-2 text-xs font-extrabold tabular-nums transition",
                  termMonths === option
                    ? "bg-brand text-white shadow-sm"
                    : "text-foreground/60 hover:bg-brand-soft/70",
                )}
              >
                {option}m
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold tracking-[0.14em] text-foreground/50 uppercase">
            <span>Representative APR</span>
            <span className="tabular-nums text-brand">{apr.toFixed(1)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={24.9}
            step={0.1}
            value={apr}
            onChange={(event) => setApr(Number.parseFloat(event.target.value))}
            className="w-full accent-brand"
            aria-label="Representative APR percentage"
          />
        </label>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-brand-soft/60 p-4 text-xs">
        <div>
          <dt className="font-bold text-foreground/50">Amount financed</dt>
          <dd className="mt-0.5 text-sm font-extrabold tabular-nums">
            {formatCurrency(quote.amountFinanced)}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-foreground/50">Total payable</dt>
          <dd className="mt-0.5 text-sm font-extrabold tabular-nums">
            {formatCurrency(quote.totalPayable)}
          </dd>
        </div>
        {type === "pcp" ? (
          <div className="col-span-2">
            <dt className="font-bold text-foreground/50">
              Optional final payment (GFV)
            </dt>
            <dd className="mt-0.5 text-sm font-extrabold tabular-nums">
              {formatCurrency(quote.balloon)}
              <span className="ml-2 font-bold text-foreground/50">
                — pay it, refinance it, or hand the car back
              </span>
            </dd>
          </div>
        ) : (
          <div className="col-span-2">
            <dt className="font-bold text-foreground/50">Total interest</dt>
            <dd className="mt-0.5 text-sm font-extrabold tabular-nums">
              {formatCurrency(quote.totalInterest)}
            </dd>
          </div>
        )}
      </dl>

      <Link
        href={quoteHref}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-extrabold text-white transition hover:bg-brand/90"
      >
        Get a personalised quote
      </Link>

      <p className="mt-3 text-[10px] leading-4 text-foreground/45">
        Illustration only. Figures assume monthly repayments in arrears and no
        arrangement fees. Actual APR and — for PCP — the guaranteed future
        value depend on lender underwriting, mileage and vehicle age. Subject
        to status. Finance is arranged through FCA-authorised partners.
      </p>
    </div>
  );
}
