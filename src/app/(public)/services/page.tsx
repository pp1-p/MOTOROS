import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

export const metadata: Metadata = {
  title: "MOT, servicing & workshop",
  description:
    "MOT, servicing, diagnostics and repairs from a workshop that gives you a straight answer first. Book a call with our service team and we will price the job before we start.",
};

const services = [
  {
    title: "MOT",
    copy: "Class 4 MOT with a plain-English pass or advisory list.",
  },
  {
    title: "Full & interim servicing",
    copy: "Manufacturer-schedule servicing using the right parts and fluids.",
  },
  {
    title: "Diagnostics",
    copy: "Warning-light and fault-finding using dealer-level equipment.",
  },
  {
    title: "Brakes & tyres",
    copy: "Discs, pads, tyres and geometry — safety-critical work done properly.",
  },
  {
    title: "Air-con service",
    copy: "Re-gas, leak check and system health across R134a and R1234yf.",
  },
  {
    title: "Cambelts & clutches",
    copy: "The bigger interval jobs, priced up front before any work starts.",
  },
];

const promises = [
  {
    icon: ClipboardCheck,
    title: "You see the price before we start",
    copy: "No mystery bills — we quote the job, get your OK, and then get on with it.",
  },
  {
    icon: BadgeCheck,
    title: "Right first time, or we make it right",
    copy: "If something we did needs revisiting, we look at it again straight away.",
  },
  {
    icon: ShieldCheck,
    title: "Records you can keep",
    copy: "A tidy digital record of everything that has been done, ready when you sell.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#10231f] py-16 text-white sm:py-24">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]"
        />
        <div className="container-shell relative grid gap-12 lg:grid-cols-[1fr_0.75fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
              <Sparkles className="size-4" aria-hidden />
              MOT · Servicing · Repairs
            </p>
            <h1 className="mt-5 max-w-4xl tracking-display-lg font-display text-6xl text-balance sm:text-8xl">
              A workshop that
              <span className="block text-[#e3bd7e]">talks to you first.</span>
            </h1>
          </div>
          <div>
            <p className="text-base leading-8 text-white/68">
              MOT, servicing, diagnostics, repairs — booked with the same
              honest advice you get on the sales side. Tell us what the car is
              doing and we will book it in only when it makes sense.
            </p>
            <ul className="mt-6 grid gap-3 text-sm font-bold text-white/75">
              {[
                "Every price agreed before we lift a spanner",
                "Same-day quotes on most day-to-day work",
                "Records you can keep for resale value",
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

      <section className="border-b bg-white py-14 sm:py-20">
        <div className="container-shell">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-3xl border border-brand/20 bg-brand-soft/40 p-6 text-center sm:flex-row sm:text-left">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-brand shadow-sm">
              <CalendarClock className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold tracking-[0.14em] text-brand uppercase">
                Get a price and book in
              </p>
              <h2 className="mt-1 text-xl font-extrabold text-balance">
                Tell us the car and the issue, we&apos;ll come back with a
                figure and an available slot.
              </h2>
            </div>
            <Link
              href="/book-repair-call"
              className="cta-sheen inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-extrabold text-white transition hover:bg-brand-strong"
            >
              <Wrench className="size-4" aria-hidden />
              Book a repair call
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-extrabold tracking-[0.14em] text-brand uppercase">
              What we look after
            </p>
            <h2 className="mt-3 tracking-display-lg font-display text-4xl text-balance sm:text-5xl">
              Everyday jobs to the bigger interval work.
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <article
                key={service.title}
                className="rounded-3xl border bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_18px_50px_rgba(15,24,18,0.08)]"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Wrench className="size-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-lg font-extrabold">{service.title}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground/60">
                  {service.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-[#faf7f1] py-14 sm:py-20">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-extrabold tracking-[0.14em] text-brand uppercase">
              How we work
            </p>
            <h2 className="mt-3 tracking-display-lg font-display text-4xl text-balance sm:text-5xl">
              Straight answers before anything is stripped down.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {promises.map((item, index) => (
              <article
                key={item.title}
                className="relative rounded-3xl border bg-white p-6 sm:p-7"
              >
                <span className="absolute top-6 right-6 font-display text-3xl text-foreground/12">
                  0{index + 1}
                </span>
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-lg font-extrabold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-foreground/60">
                  {item.copy}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <Link
              href="/book-repair-call"
              className="cta-sheen inline-flex h-14 min-w-64 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-base font-extrabold text-white transition hover:bg-brand-strong"
            >
              <Wrench className="size-5" aria-hidden />
              Book a repair call
            </Link>
            <p className="text-xs text-foreground/50">
              Prefer a quick question first?{" "}
              <Link
                href="/contact"
                className="underline decoration-brand/40 underline-offset-2"
              >
                Message the workshop
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
