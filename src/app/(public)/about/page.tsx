import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  HeartHandshake,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wrench,
} from "lucide-react";

import { getPublicSiteConfig } from "@/lib/data/site-config";

export const metadata: Metadata = {
  title: "About us",
  description:
    "Meet the family behind our independent dealership — Indijit and Rashpal — and the small team that looks after every car and every customer.",
};

type TeamMember = {
  name: string;
  role: string;
  initial: string;
  tint: string;
  bio: string;
  isOwner?: boolean;
};

const team: TeamMember[] = [
  {
    name: "Indijit",
    role: "Co-founder & Director",
    initial: "I",
    tint: "#1b5c4f",
    bio: "Handles the buying, the mechanical inspections and most of the workshop side. Would rather take an hour longer on a car than let one leave before it's right.",
    isOwner: true,
  },
  {
    name: "Rashpal",
    role: "Co-founder & Director",
    initial: "R",
    tint: "#0d2a20",
    bio: "Runs the day-to-day, looks after customers from first phone call to handover, and keeps everything joined-up between sales and workshop.",
    isOwner: true,
  },
  {
    name: "Luke",
    role: "Sales & customer care",
    initial: "L",
    tint: "#3a5f4c",
    bio: "Usually the first friendly voice on the phone. Talks you through the cars honestly, arranges viewings around your diary, and makes sure the handover is smooth from start to finish.",
  },
  {
    name: "Workshop technician",
    role: "Mechanic",
    initial: "M",
    tint: "#4a6a5c",
    bio: "One of two experienced technicians on our workshop side — MOT, servicing, diagnostics and repairs. Every car we sell passes through their hands before it ever reaches you.",
  },
  {
    name: "Workshop technician",
    role: "Mechanic",
    initial: "M",
    tint: "#5a7a6b",
    bio: "Second of our two-strong workshop team. Between them they cover everything from cambelts to complex diagnostics, and they take the same pride in a service job as they do a prep job.",
  },
];

const values = [
  {
    icon: HeartHandshake,
    title: "Treat people how you'd want to be treated",
    copy: "We don't do pressure. If a car isn't right for you, we'll say so — even if it's the one you came in for.",
  },
  {
    icon: ShieldCheck,
    title: "Every car earns its place",
    copy: "We buy carefully and prepare properly. Anything we wouldn't put a family member in doesn't make it to the forecourt.",
  },
  {
    icon: Wrench,
    title: "We look after cars after you drive away",
    copy: "Our workshop is the same one that prepared the car. If something needs a look, it's the same faces you already know.",
  },
];

const testimonials = [
  {
    quote:
      "The best garage I have purchased from. On viewing the car I put down a small deposit and these guys kindly waited 6 weeks for the remaining balance. Excellent service throughout.",
    author: "Andrea T.",
    source: "Autotrader",
  },
  {
    quote:
      "Amazing service — they answered all my questions about the vehicle and they got my vehicle all cleaned for me. Condition of the car is great, they say they don't go.",
    author: "Anonymous",
    source: "Autotrader",
  },
  {
    quote:
      "Friendly and professional. Would recommend Direct Motors to anyone looking to purchase a car from them.",
    author: "Helmut S.",
    source: "Autotrader",
  },
];

export default async function AboutPage() {
  const siteConfig = await getPublicSiteConfig();

  return (
    <>
      <section className="relative overflow-hidden bg-[#15221d] py-16 text-white sm:py-24">
        <div className="absolute -top-40 right-0 size-[36rem] rounded-full bg-[#d7ad69]/10 blur-3xl" />
        <div className="container-shell relative grid gap-12 lg:grid-cols-[1fr_0.75fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
              <Sparkles className="size-4" aria-hidden />
              About {siteConfig.name}
            </p>
            <h1 className="mt-5 max-w-4xl tracking-display-lg font-display text-6xl text-balance sm:text-8xl">
              A small family team.
              <span className="block text-[#e3bd7e]">A big obsession with getting it right.</span>
            </h1>
          </div>
          <div>
            <p className="text-base leading-8 text-white/68">
              We&apos;re an independent dealership run by two brothers,
              Indijit and Rashpal. We buy cars we&apos;d happily put our own
              family in, prepare them properly, and stand behind them long
              after you drive away.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-extrabold tracking-[0.14em] text-white/70 uppercase">
              <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5">
                Independent
              </span>
              <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5">
                Family-run
              </span>
              <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5">
                Sales · Workshop · Sourcing
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-white py-14 sm:py-20">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-extrabold tracking-[0.14em] text-brand uppercase">
              Meet the team
            </p>
            <h2 className="mt-3 tracking-display-lg font-display text-4xl text-balance sm:text-5xl">
              The people you&apos;ll actually speak to.
            </h2>
            <p className="mt-4 text-base leading-8 text-foreground/65">
              No call centres, no rotating staff — you&apos;ll be dealing
              with the same small team from your first message right through
              to the workshop.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {team.map((member, index) => (
              <article
                key={`${member.name}-${index}`}
                className="rounded-3xl border bg-background p-7 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_18px_50px_rgba(15,24,18,0.08)] sm:p-8"
              >
                <div className="flex items-center gap-5">
                  <span
                    aria-hidden
                    className="grid size-20 shrink-0 place-items-center rounded-full font-display text-4xl font-extrabold text-white shadow-inner shadow-black/30 ring-2 ring-white/60"
                    style={{ backgroundColor: member.tint }}
                  >
                    {member.initial}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl font-extrabold">{member.name}</h3>
                      {member.isOwner ? (
                        <span className="rounded-full bg-[#d7ad69]/15 px-2 py-0.5 text-[10px] font-extrabold tracking-[0.14em] text-[#a97b1f] uppercase">
                          Owner
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-bold text-brand">
                      {member.role}
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-7 text-foreground/65">
                  {member.bio}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b bg-[#faf7f1] py-14 sm:py-20">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-extrabold tracking-[0.14em] text-brand uppercase">
              What we stand for
            </p>
            <h2 className="mt-3 tracking-display-lg font-display text-4xl text-balance sm:text-5xl">
              Straightforward, every step.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {values.map((value, index) => (
              <article
                key={value.title}
                className="relative rounded-3xl border bg-white p-6 sm:p-7"
              >
                <span className="absolute top-6 right-6 font-display text-3xl text-foreground/12">
                  0{index + 1}
                </span>
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <value.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-lg font-extrabold">{value.title}</h3>
                <p className="mt-3 text-sm leading-7 text-foreground/60">
                  {value.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b bg-white py-14 sm:py-20">
        <div className="container-shell">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold tracking-[0.14em] text-brand uppercase">
                Customer reviews
              </p>
              <h2 className="mt-3 tracking-display-lg font-display text-4xl text-balance sm:text-5xl">
                Reviewed by real customers.
              </h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-foreground/65">
                Every review below is verified on our Autotrader retailer
                page. Read the full history — we&apos;ve got nothing to hide.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4 rounded-2xl border bg-background px-5 py-4">
              <span className="grid size-12 place-items-center rounded-xl bg-[#f27021] text-white">
                <BadgeCheck className="size-6" aria-hidden />
              </span>
              <div>
                <p className="flex items-center gap-1 text-lg font-extrabold">
                  Autotrader{" "}
                  <span className="ml-1 flex text-[#f27021]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="size-4 fill-[#f27021] stroke-[#f27021]"
                        aria-hidden
                      />
                    ))}
                  </span>
                </p>
                <p className="text-xs font-bold text-foreground/55">
                  Verified retailer reviews
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((review) => (
              <li
                key={review.author}
                className="relative flex flex-col rounded-3xl border bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_18px_50px_rgba(15,24,18,0.08)] sm:p-7"
              >
                <Quote
                  className="size-8 text-brand/40"
                  aria-hidden
                />
                <p className="mt-4 flex-1 text-sm leading-7 text-foreground/75">
                  &ldquo;{review.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4 text-xs">
                  <div>
                    <p className="font-extrabold text-foreground/85">
                      {review.author}
                    </p>
                    <p className="mt-0.5 font-bold text-foreground/50">
                      via {review.source}
                    </p>
                  </div>
                  <span className="flex text-[#f27021]" aria-label="5 star review">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="size-3.5 fill-[#f27021] stroke-[#f27021]"
                        aria-hidden
                      />
                    ))}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-3xl border border-brand/20 bg-brand-soft/40 p-6 sm:flex-row sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand shadow-sm">
                <Users className="size-6" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-extrabold tracking-[0.14em] text-brand uppercase">
                  Read every review
                </p>
                <p className="mt-1 font-extrabold text-foreground">
                  Our full Autotrader retailer profile is public.
                </p>
              </div>
            </div>
            <a
              href="https://www.autotrader.co.uk/dealers/staffordshire/walsall/direct-motors-ltd-10015087"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-sheen inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-extrabold text-white transition hover:bg-brand-strong"
            >
              Open reviews on Autotrader
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container-shell">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#171814] px-6 py-12 text-white sm:px-12 lg:px-16 lg:py-16">
            <div className="absolute -top-24 -right-20 size-80 rounded-full bg-[#d7ad69]/15 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="tracking-display-lg font-display text-4xl text-balance sm:text-5xl">
                  Come and say hello.
                </h2>
                <p className="mt-4 leading-7 text-white/65">
                  Browse our current stock, ask us to source something
                  specific, or pop in for a coffee and a chat.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/cars"
                  className="cta-sheen inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#d7ad69] px-6 text-sm font-extrabold text-[#171814] transition hover:bg-[#e3bd7e]"
                >
                  See our cars
                </Link>
                <Link
                  href="/find-us"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/[0.06] px-6 text-sm font-extrabold text-white transition hover:bg-white/10"
                >
                  Find us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
