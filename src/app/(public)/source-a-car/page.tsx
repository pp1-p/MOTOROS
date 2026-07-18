import type { Metadata } from "next";
import {
  Check,
  ClipboardList,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SourceCarForm } from "@/components/forms/source-car-form";

export const metadata: Metadata = {
  title: "Source a car",
  description:
    "Tell our independent dealership what you are looking for. We will search trusted channels, assess suitable vehicles and present credible options.",
};

const process = [
  {
    icon: ClipboardList,
    title: "Build a proper brief",
    copy: "We capture the specification, use case, budget and details that matter—not just a make and model.",
  },
  {
    icon: Search,
    title: "Search the wider market",
    copy: "Our team looks across trusted supply channels and filters out cars that do not stand up to scrutiny.",
  },
  {
    icon: ShieldCheck,
    title: "Choose with context",
    copy: "We explain the credible options, known facts and next checks before you make any commitment.",
  },
];

export default function SourceACarPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#15221d] py-16 text-white sm:py-24">
        <div className="absolute -top-40 right-0 size-[36rem] rounded-full bg-[#d7ad69]/10 blur-3xl" />
        <div className="container-shell relative grid gap-12 lg:grid-cols-[1fr_0.75fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
              <Sparkles className="size-4" aria-hidden />
              Personal car sourcing
            </p>
            <h1 className="mt-5 max-w-4xl font-display text-6xl leading-[0.92] tracking-tight text-balance sm:text-8xl">
              Your brief.
              <span className="block text-[#e3bd7e]">Our search.</span>
            </h1>
          </div>
          <div>
            <p className="text-base leading-8 text-white/68">
              Looking for a specific car—or simply a better example than the
              ones you have seen? Tell us what right looks like and let our team
              do the searching.
            </p>
            <ul className="mt-6 grid gap-3 text-sm font-bold text-white/75">
              {[
                "No commitment at enquiry stage",
                "Your budget and priorities stay central",
                "Human assessment before options reach you",
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
          {process.map((item, index) => (
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
              Start the search
            </p>
            <h2 className="mt-4 font-display text-5xl leading-[0.96] tracking-tight text-balance sm:text-6xl">
              Tell us enough to be useful.
            </h2>
            <p className="mt-6 text-base leading-8 text-foreground/65">
              The more context you share, the more focused our first
              conversation can be. It usually takes five minutes.
            </p>
            <div className="mt-8 rounded-2xl bg-brand-soft p-5">
              <p className="flex items-start gap-3 text-sm leading-6 text-brand-strong">
                <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
                Your request is stored privately in DealerOS and is visible
                only to authorised dealership staff.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-8 lg:p-10">
            <SourceCarForm />
          </div>
        </div>
      </section>
    </>
  );
}

