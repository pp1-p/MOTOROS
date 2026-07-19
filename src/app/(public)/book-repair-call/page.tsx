import type { Metadata } from "next";
import {
  CalendarCheck,
  Check,
  Clock3,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";

import { RepairBookingForm } from "@/components/forms/repair-booking-form";

export const metadata: Metadata = {
  title: "Book a repair discussion",
  description:
    "Choose an available time for our service team to call and discuss your vehicle repair, service or diagnostic concern.",
};

export default function BookRepairCallPage() {
  return (
    <>
      <section className="border-b bg-[#15221d] py-14 text-white sm:py-20">
        <div className="container-shell grid gap-10 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <div>
            <p className="text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
              Live repair-call diary
            </p>
            <h1 className="mt-4 max-w-4xl tracking-display-lg font-display text-6xl text-balance sm:text-8xl">
              Book a useful first conversation.
            </h1>
          </div>
          <p className="text-base leading-8 text-white/65">
            Choose an available time and give the service team the context they
            need. We will call you to discuss the safest, most practical next
            step.
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="container-shell grid gap-10 lg:grid-cols-[0.62fr_1fr] lg:items-start lg:gap-16">
          <aside className="lg:sticky lg:top-8">
            <h2 className="tracking-display font-display text-4xl">
              Before you book
            </h2>
            <ul className="mt-7 grid gap-5">
              {[
                {
                  icon: CalendarCheck,
                  title: "Only available times are shown",
                  copy: "The diary checks current call capacity for your chosen date.",
                },
                {
                  icon: PhoneCall,
                  title: "This is a telephone call",
                  copy: "It does not confirm workshop time or authorise any repair work.",
                },
                {
                  icon: Clock3,
                  title: "Allow around 15 minutes",
                  copy: "Have the vehicle details and any warning messages to hand.",
                },
                {
                  icon: ShieldCheck,
                  title: "Your information stays private",
                  copy: "Only authorised dealership staff can see the booking details.",
                },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                    <item.icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-foreground/55">
                      {item.copy}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm leading-6 text-amber-900">
                <strong>Urgent safety issue?</strong> Stop driving if the car
                may be unsafe. Use emergency or breakdown services as
                appropriate; this booking form is not monitored as an emergency
                channel.
              </p>
            </div>
          </aside>

          <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center gap-3 border-b pb-6">
              <span className="grid size-10 place-items-center rounded-full bg-brand text-white">
                <Check className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-extrabold">Secure booking request</p>
                <p className="text-xs text-foreground/50">
                  Times shown in Europe/London
                </p>
              </div>
            </div>
            <RepairBookingForm />
          </div>
        </div>
      </section>
    </>
  );
}
