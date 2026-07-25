import type { Metadata } from "next";
import { CarFront, Check, Clock3, ShieldCheck, Sparkles } from "lucide-react";

import { PartExchangeForm } from "@/components/forms/part-exchange-form";

export const metadata: Metadata = {
  title: "Part exchange your car",
  description:
    "Tell us about the car you would like to part exchange and we will give you an honest valuation against the vehicle you are interested in.",
};

const promises = [
  {
    icon: ShieldCheck,
    title: "A straight, honest valuation",
    copy: "No inflated headline prices or last-minute deductions. What we quote is what we buy at.",
  },
  {
    icon: Clock3,
    title: "Turnaround in one working day",
    copy: "Send the details and we will come back to you with a firm figure — usually the same day.",
  },
  {
    icon: Check,
    title: "One conversation covers both cars",
    copy: "We settle any outstanding finance, handle the paperwork and put the balance towards your next car.",
  },
];

export default function PartExchangePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#15221d] py-16 text-white sm:py-24">
        <div className="absolute -top-40 right-0 size-[36rem] rounded-full bg-[#d7ad69]/10 blur-3xl" />
        <div className="container-shell relative grid gap-12 lg:grid-cols-[1fr_0.75fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
              <Sparkles className="size-4" aria-hidden />
              Part exchange
            </p>
            <h1 className="mt-5 max-w-4xl tracking-display-lg font-display text-6xl text-balance sm:text-8xl">
              Trade your car in.
              <span className="block text-[#e3bd7e]">One easy handover.</span>
            </h1>
          </div>
          <div>
            <p className="text-base leading-8 text-white/68">
              Looking to part exchange? Tell us about your car and we will give
              you a fair figure, take care of the paperwork and set it against
              whatever you are buying from us.
            </p>
            <ul className="mt-6 grid gap-3 text-sm font-bold text-white/75">
              {[
                "No obligation to accept our offer",
                "We settle outstanding finance if there is any",
                "Handover the same day if it suits you",
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
              Send your car details
            </p>
            <h2 className="mt-4 tracking-display-lg font-display text-5xl text-balance sm:text-6xl">
              A few details is all we need.
            </h2>
            <p className="mt-6 text-base leading-8 text-foreground/65">
              Give us the basics and we will come back with an honest
              valuation, usually within one working day.
            </p>
            <div className="mt-8 rounded-2xl bg-brand-soft p-5">
              <p className="flex items-start gap-3 text-sm leading-6 text-brand-strong">
                <CarFront className="mt-0.5 size-5 shrink-0" aria-hidden />
                Have the V5C to hand? It makes matching your car to the market
                data quicker and more accurate.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-8 lg:p-10">
            <PartExchangeForm />
          </div>
        </div>
      </section>
    </>
  );
}
