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
    title: "Cars we'd put our own family in",
    copy: "We only take on cars we'd be happy to hand the keys to friends and family. If we wouldn't drive it, we won't sell it.",
  },
  {
    icon: ShieldCheck,
    title: "Checked, prepared, ready to drive",
    copy: "Every car is inspected, MOT'd where needed and safety-checked before you collect it. You'll see the checklist.",
  },
  {
    icon: BadgeCheck,
    title: "No pressure, ever",
    copy: "Take your time. Bring the kids. Ask us anything. Take it out for a proper test drive. We're here when you're ready.",
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
              { icon: CarFront, text: "Family-friendly used cars" },
              { icon: SearchCheck, text: "We'll find you the right one" },
              { icon: Wrench, text: "Trusted local workshop" },
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
            eyebrow="This week's cars"
            title="Have a look around"
            description="Every car with full details, honest photos and a real price. Click one to see everything, or pop in for a cuppa and a proper look."
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
                Can't see it? We'll find it.
              </p>
              <h2 className="tracking-display-lg font-display text-5xl text-balance sm:text-6xl">
                Tell us what you need. We'll go and find it for you.
              </h2>
              <p className="mt-6 text-base leading-8 text-white/65">
                Growing family? First car for the eldest? Something for towing
                the caravan? Tell us what you're after and we'll look through
                our trusted network — no pressure, no commitment until you're
                happy.
              </p>
              <ol className="mt-8 grid gap-4">
                {[
                  "Tell us what you need and your budget",
                  "We do the searching — no time wasted at your end",
                  "You look at what we find and decide from there",
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
            eyebrow="What you can expect"
            title="Straight talk. Real cars. Proper aftercare."
            description="We're a family-run dealership. We look after people the way we'd like to be looked after. Here's what that means in practice."
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
              Something up with the car?
            </p>
            <h2 className="mt-4 max-w-2xl tracking-display-lg font-display text-5xl text-balance">
              Give us a ring. We'll listen and help.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-foreground/65">
              Warning light on? Odd noise? Just due a service? Book a quick
              call with our workshop and we'll tell you honestly what needs
              doing — and what doesn't. No sales patter, no scare tactics.
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
              { value: "01", label: "Pick a time that suits you" },
              { value: "02", label: "Tell us what the car's doing" },
              { value: "03", label: "Chat with the workshop directly" },
              { value: "04", label: "Sort a plan you're happy with" },
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
                  Ready when you are. Kettle's on.
                </h2>
                <p className="mt-5 max-w-2xl leading-7 text-white/65">
                  Whether you're set on a car, want us to search for one, or
                  just have a question — get in touch. You'll get a proper
                  reply from a real person, usually the same day.
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
