import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  CarFront,
  Check,
  CircleGauge,
  Disc3,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/public/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Vehicle repairs and servicing",
  description:
    "Discuss diagnostics, servicing, MOT preparation, brakes, tyres, electrical faults, mechanical repairs and inspections with our workshop team.",
};

const services = [
  {
    icon: ScanLine,
    title: "Diagnostics",
    copy: "Structured fault-finding for warning lights, unusual behaviour and intermittent problems.",
  },
  {
    icon: Settings,
    title: "Servicing",
    copy: "Routine servicing tailored to the vehicle, age, mileage and manufacturer schedule.",
  },
  {
    icon: ShieldCheck,
    title: "MOT preparation",
    copy: "Pre-test inspection and practical advice on issues that need attention.",
  },
  {
    icon: Disc3,
    title: "Brakes & tyres",
    copy: "Inspection, measurement and replacement advice focused on safety and honest wear assessment.",
  },
  {
    icon: BatteryCharging,
    title: "Batteries & electrical",
    copy: "Battery health, charging faults, starting issues and common electrical concerns.",
  },
  {
    icon: Wrench,
    title: "Mechanical repairs",
    copy: "Clear diagnosis, itemised estimates and agreed work before repairs move forward.",
  },
  {
    icon: Activity,
    title: "Vehicle inspections",
    copy: "A considered assessment when buying, selling or planning work on a vehicle.",
  },
  {
    icon: CircleGauge,
    title: "General concerns",
    copy: "Not sure what category fits? Start with a call and describe what the car is doing.",
  },
];

export default function RepairsPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#101512] text-white">
        <Image
          src="/images/hero-showroom.png"
          alt="Independent dealership vehicles presented in a clean showroom"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(10,15,12,0.96)_0%,rgba(10,15,12,0.82)_50%,rgba(10,15,12,0.38)_100%)]" />
        <div className="container-shell flex min-h-[620px] items-center py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
              <Sparkles className="size-4" aria-hidden />
              Repairs & servicing
            </p>
            <h1 className="mt-5 font-display text-6xl leading-[0.92] tracking-tight text-balance sm:text-8xl">
              Understand the issue.
              <span className="block text-[#e3bd7e]">Agree the next step.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/68">
              Good repair work starts with a useful conversation. Book a call
              with the service team, explain what is happening and get a clear
              plan from there.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-9 bg-[#d7ad69] text-[#171814] hover:bg-[#e3bd7e]"
            >
              <Link href="/book-repair-call">
                Book a repair discussion
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="container-shell">
          <SectionHeading
            eyebrow="Workshop services"
            title="Practical support for the jobs cars actually need"
            description="Services can be tailored through DealerOS. If you are unsure where your concern fits, choose diagnostics or general concerns when booking."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <article
                key={service.title}
                className="rounded-3xl border bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <service.icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-6 text-lg font-extrabold">{service.title}</h2>
                <p className="mt-3 text-sm leading-7 text-foreground/60">
                  {service.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-white py-16 sm:py-24">
        <div className="container-shell grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem]">
            <Image
              src="/images/hero-showroom.png"
              alt="Vehicles awaiting care from the independent dealership team"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-extrabold tracking-[0.18em] text-brand uppercase">
              What happens next
            </p>
            <h2 className="mt-4 font-display text-5xl leading-none tracking-tight text-balance sm:text-6xl">
              A call first. Workshop time when it makes sense.
            </h2>
            <p className="mt-6 text-base leading-8 text-foreground/65">
              The online diary books a telephone discussion, not a guaranteed
              workshop appointment. That lets us understand the symptoms,
              assess urgency and make sure the right time and expertise are
              allocated.
            </p>
            <ol className="mt-8 grid gap-4">
              {[
                "Choose a live call slot and describe the vehicle",
                "A service adviser reviews the information before the call",
                "We discuss likely next checks and any immediate safety concern",
                "Workshop time and estimates are agreed separately where needed",
              ].map((item, index) => (
                <li key={item} className="flex items-start gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-extrabold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm leading-6 font-bold">{item}</span>
                </li>
              ))}
            </ol>
            <Button asChild size="lg" className="mt-9">
              <Link href="/book-repair-call">
                Choose a call time
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="container-shell">
          <div className="rounded-[2rem] bg-[#15221d] p-6 text-white sm:p-10 lg:p-14">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end">
              <div>
                <CarFront className="size-7 text-[#d7ad69]" aria-hidden />
                <h2 className="mt-5 font-display text-5xl leading-none tracking-tight">
                  Is it safe to keep driving?
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65">
                  If you see a red warning light, smell fuel or burning, lose
                  braking or steering assistance, or believe the car is unsafe,
                  stop somewhere safe and contact an appropriate breakdown
                  provider. An online call booking is not an emergency service.
                </p>
              </div>
              <ul className="grid gap-3 text-sm font-bold text-white/75">
                {[
                  "Do not continue driving an unsafe vehicle",
                  "Call emergency services where there is immediate danger",
                  "Use breakdown assistance for roadside recovery",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check className="size-4 text-[#d7ad69]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
