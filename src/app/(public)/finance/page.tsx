import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Calculator,
  Check,
  HandCoins,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { FinanceEnquiryForm } from "@/components/forms/finance-enquiry-form";

export const metadata: Metadata = {
  title: "Car finance made simple",
  description:
    "Spread the cost of your next car with a competitive, hassle-free finance quote from our regulated finance partners.",
};

const promises = [
  {
    icon: HandCoins,
    title: "Competitive rates from trusted lenders",
    copy: "We work with regulated finance partners so you see quotes that stand up to comparison.",
  },
  {
    icon: BadgeCheck,
    title: "Tailored to your circumstances",
    copy: "Deposit, term and monthly figure — we adjust things until the numbers actually make sense for you.",
  },
  {
    icon: ShieldCheck,
    title: "No pressure, no surprises",
    copy: "A soft quote first, so you can see the shape of things before anything hits your credit file.",
  },
];

export default function FinancePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#15221d] py-16 text-white sm:py-24">
        <div className="absolute -top-40 right-0 size-[36rem] rounded-full bg-[#d7ad69]/10 blur-3xl" />
        <div className="container-shell relative grid gap-12 lg:grid-cols-[1fr_0.75fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
              <Sparkles className="size-4" aria-hidden />
              Car finance
            </p>
            <h1 className="mt-5 max-w-4xl tracking-display-lg font-display text-6xl text-balance sm:text-8xl">
              Finance that fits you,
              <span className="block text-[#e3bd7e]">not the other way round.</span>
            </h1>
          </div>
          <div>
            <p className="text-base leading-8 text-white/68">
              Whether you are after a stylish practical family car or a sleek
              sporty saloon, we work with regulated finance partners to put
              together a quote that works for your circumstances.
            </p>
            <ul className="mt-6 grid gap-3 text-sm font-bold text-white/75">
              {[
                "Soft quote first — no credit-file impact",
                "Clear monthly figure and total payable",
                "Same friendly team from quote to keys",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Check className="size-4 text-[#d7ad69]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b bg-white py-12 sm:py-16">
        <div className="container-shell grid gap-5 md:grid-cols-3">
          {promises.map((item, index) => (
            <article
              key={item.title}
              className="relative rounded-3xl border bg-background p-6 sm:p-7"
            >
              <span className="absolute top-6 right-6 font-display text-3xl text-foreground/12">
                0{index + 1}
              </span>
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                <item.icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-6 text-lg font-extrabold">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-foreground/60">
                {item.copy}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="container-shell grid gap-10 lg:grid-cols-[0.66fr_1fr] lg:items-start lg:gap-16">
          <div className="lg:sticky lg:top-8">
            <p className="text-xs font-extrabold tracking-[0.18em] text-brand uppercase">
              Get a quote
            </p>
            <h2 className="mt-4 tracking-display-lg font-display text-5xl text-balance sm:text-6xl">
              Tell us the shape of a payment you can live with.
            </h2>
            <p className="mt-6 text-base leading-8 text-foreground/65">
              A few honest numbers is all we need to start. The quote is
              indicative until a full application is submitted.
            </p>
            <div className="mt-8 rounded-2xl bg-brand-soft p-5">
              <p className="flex items-start gap-3 text-sm leading-6 text-brand-strong">
                <Calculator className="mt-0.5 size-5 shrink-0" aria-hidden />
                Already picked a car?{" "}
                <Link
                  href="/cars"
                  className="ml-1 underline decoration-brand/40 underline-offset-2"
                >
                  Browse our stock
                </Link>{" "}
                and mention it in the enquiry.
              </p>
            </div>
            <p className="mt-6 text-xs leading-6 text-foreground/45">
              Finance is subject to status, affordability checks and lender
              approval. Terms apply. We are a credit broker, not a lender, and
              may receive a fee from the finance provider.
            </p>
          </div>
          <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-8 lg:p-10">
            <FinanceEnquiryForm />
          </div>
        </div>
      </section>
    </>
  );
}
