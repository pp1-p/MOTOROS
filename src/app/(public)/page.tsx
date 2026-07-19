import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  CarFront,
  ChevronRight,
  CircleGauge,
  Clock3,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/public/section-heading";
import { SpotlightCard } from "@/components/public/spotlight-card";
import { VehicleCard } from "@/components/public/vehicle-card";
import { Button } from "@/components/ui/button";
import { getPublicSiteConfig } from "@/lib/data/site-config";
import { getFeaturedVehicles } from "@/lib/data/vehicles";
import { buildPublicSeoTitle } from "@/lib/site-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getPublicSiteConfig();
  return {
    title: {
      absolute: buildPublicSeoTitle(siteConfig.seoTitle, siteConfig.name),
    },
    description: siteConfig.seoDescription,
  };
}

const promises = [
  {
    icon: SearchCheck,
    title: "Selected with judgement",
    copy: "We look beyond the badge and mileage, choosing cars we would be comfortable recommending.",
  },
  {
    icon: ShieldCheck,
    title: "Prepared with care",
    copy: "Every retail car follows a documented inspection and preparation path before handover.",
  },
  {
    icon: BadgeCheck,
    title: "Explained clearly",
    copy: "Straight answers, useful context and time to decide—without unnecessary pressure.",
  },
];

export default async function HomePage() {
  const [featuredVehicles, siteConfig] = await Promise.all([
    getFeaturedVehicles(4),
    getPublicSiteConfig(),
  ]);

  return (
    <>
      <section className="relative isolate min-h-[680px] overflow-hidden bg-[#111713] text-white sm:min-h-[720px]">
        <Image
          src={siteConfig.heroImageUrl}
          alt={siteConfig.heroImageAlt}
          fill
          priority
          sizes="100vw"
          className="hero-zoom object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,15,12,0.94)_0%,rgba(10,15,12,0.76)_42%,rgba(10,15,12,0.22)_75%,rgba(10,15,12,0.36)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(10,15,12,0.78)_0%,transparent_42%)]" />
        <div className="container-shell relative flex min-h-[680px] items-center py-20 sm:min-h-[720px]">
          <div className="max-w-3xl">
            <p
              className="enter mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 py-2 text-xs font-extrabold tracking-[0.13em] text-white/85 uppercase backdrop-blur"
              style={{ "--enter-delay": "0.04s" } as React.CSSProperties}
            >
              <Sparkles className="size-4 text-[#e3bd7e]" aria-hidden />
              {siteConfig.heroEyebrow}
            </p>
            <h1
              className="enter tracking-display-lg font-display text-6xl font-medium text-balance sm:text-7xl lg:text-[6.5rem]"
              style={{ "--enter-delay": "0.12s" } as React.CSSProperties}
            >
              {siteConfig.heroHeadline}
            </h1>
            <p
              className="enter mt-7 max-w-xl text-base leading-8 text-white/72 sm:text-lg"
              style={{ "--enter-delay": "0.2s" } as React.CSSProperties}
            >
              {siteConfig.heroSummary}
            </p>
            <div
              className="enter mt-9 flex flex-col gap-3 sm:flex-row"
              style={{ "--enter-delay": "0.28s" } as React.CSSProperties}
            >
              <Button
                asChild
                size="lg"
                className="cta-sheen bg-[#d7ad69] text-[#171814] hover:bg-[#e3bd7e]"
              >
                <Link href={siteConfig.primaryHref}>
                  {siteConfig.primaryLabel}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-black/10 text-white backdrop-blur hover:bg-white/10"
              >
                <Link href="/source-a-car">Ask us to find your car</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/25 backdrop-blur-md">
          <div className="container-shell grid grid-cols-1 divide-y divide-white/10 py-2 text-white/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              { icon: CarFront, text: "Quality used vehicles" },
              { icon: SearchCheck, text: "Personal car sourcing" },
              { icon: Wrench, text: "Repairs and servicing" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center justify-center gap-3 px-5 py-4 text-xs font-bold tracking-[0.08em] uppercase"
              >
                <item.icon className="size-4 text-[#e3bd7e]" aria-hidden />
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="container-shell">
          <SectionHeading
            eyebrow="Current stock"
            title="Cars worth making time for"
            description="A considered selection of used cars, each presented with the useful details up front."
            action={
              <Button asChild variant="outline">
                <Link href="/cars">
                  View every car
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            }
          />
          {featuredVehicles.length ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {featuredVehicles.map((vehicle, index) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  priority={index < 2}
                />
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-3xl border bg-white p-10 text-center">
              <h3 className="text-xl font-extrabold">
                Fresh vehicles are being prepared
              </h3>
              <p className="mt-2 text-sm text-foreground/60">
                Tell us what you need and we can search our trusted network.
              </p>
              <Button asChild className="mt-5">
                <Link href="/source-a-car">Start a search</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden bg-[#13251f] text-white">
        <div className="container-shell grid lg:grid-cols-[1fr_1.05fr]">
          <div className="relative min-h-[420px] lg:min-h-[620px]">
            <Image
              src="/images/hero-showroom.png"
              alt="Carefully presented vehicles inside the dealership showroom"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#13251f]/50 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#13251f]/35]" />
          </div>
          <div className="flex items-center py-16 lg:px-16 lg:py-24">
            <div className="max-w-xl">
              <p className="mb-4 text-xs font-extrabold tracking-[0.18em] text-[#e3bd7e] uppercase">
                Personal car sourcing
              </p>
              <h2 className="tracking-display-lg font-display text-5xl text-balance sm:text-6xl">
                Can’t see the right one? Let us go and find it.
              </h2>
              <p className="mt-6 text-base leading-8 text-white/65">
                Give us the brief—from the essential specification to the
                details that make a car feel right. We will search, assess and
                present credible options, while you stay in control.
              </p>
              <ol className="mt-8 grid gap-4">
                {[
                  "Tell us the car, budget and non-negotiables",
                  "We search a wider trusted supply network",
                  "You review the best options before any commitment",
                ].map((step, index) => (
                  <li key={step} className="flex items-center gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#d7ad69]/45 bg-[#d7ad69]/10 text-xs font-extrabold text-[#e3bd7e]">
                      {index + 1}
                    </span>
                    <span className="text-sm font-bold text-white/80">{step}</span>
                  </li>
                ))}
              </ol>
              <Button
                asChild
                size="lg"
                className="cta-sheen mt-9 bg-[#d7ad69] text-[#171814] hover:bg-[#e3bd7e]"
              >
                <Link href="/source-a-car">
                  Build your brief
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="container-shell">
          <SectionHeading
            eyebrow="Our approach"
            title="Good service is a process, not a promise"
            description="We keep the important parts visible: what has been checked, what happens next, and who you can speak to."
            align="centre"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {promises.map((item) => (
              <SpotlightCard
                key={item.title}
                className="reveal rounded-3xl border bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-[#d7ad69]/60 hover:shadow-[0_18px_50px_rgba(15,24,18,0.1)] sm:p-8"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <item.icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-6 text-xl font-extrabold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-foreground/60">
                  {item.copy}
                </p>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-white">
        <div className="container-shell grid lg:grid-cols-[1fr_0.78fr]">
          <div className="py-16 lg:py-20 lg:pr-16">
            <p className="text-xs font-extrabold tracking-[0.18em] text-brand uppercase">
              Workshop support
            </p>
            <h2 className="mt-4 max-w-2xl tracking-display-lg font-display text-5xl text-balance">
              A calm first step when your car needs attention.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-foreground/65">
              Book a short call with our service team. We will listen to what
              the vehicle is doing, advise on the safest next step and arrange
              workshop time where appropriate.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/book-repair-call">
                  <Clock3 aria-hidden />
                  Book a repair call
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/repairs">Explore workshop services</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-px border-t bg-border sm:grid-cols-2 lg:border-t-0 lg:border-l">
            {[
              { value: "01", label: "Choose a live call time" },
              { value: "02", label: "Describe the issue clearly" },
              { value: "03", label: "Speak with the right person" },
              { value: "04", label: "Agree the practical next step" },
            ].map((item) => (
              <SpotlightCard
                key={item.value}
                className="group flex min-h-36 flex-col justify-between bg-background p-6 transition-colors duration-300 hover:bg-brand-soft/40"
              >
                <span className="font-display text-3xl text-brand transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:text-brand-strong">
                  {item.value}
                </span>
                <span className="max-w-40 text-sm font-extrabold">
                  {item.label}
                </span>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="container-shell">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#171814] px-6 py-12 text-white sm:px-12 lg:px-16 lg:py-16">
            <div className="absolute -top-24 -right-20 size-80 rounded-full bg-[#d7ad69]/15 blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <CircleGauge className="mb-5 size-7 text-[#d7ad69]" aria-hidden />
                <h2 className="tracking-display-lg font-display text-5xl text-balance sm:text-6xl">
                  Ready when you are. No pressure before then.
                </h2>
                <p className="mt-5 max-w-2xl leading-7 text-white/65">
                  Browse the current stock, send us a brief, or simply ask a
                  question. We will give you a useful answer and a clear next
                  step.
                </p>
              </div>
              <Button
                asChild
                size="lg"
                className="cta-sheen shrink-0 bg-[#d7ad69] text-[#171814] hover:bg-[#e3bd7e]"
              >
                <Link href="/contact">
                  Start a conversation
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
