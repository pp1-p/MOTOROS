import type { Metadata } from "next";
import {
  Clock3,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
} from "lucide-react";

import { ContactForm } from "@/components/forms/contact-form";
import { getPublicSiteConfig } from "@/lib/data/site-config";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Speak to the DealerOS dealership team about a car, personal sourcing, repairs or any general question.",
};

export default async function ContactPage() {
  const publicSiteConfig = await getPublicSiteConfig();
  return (
    <>
      <section className="border-b bg-[#15221d] py-14 text-white sm:py-20">
        <div className="container-shell">
          <p className="text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
            Contact the team
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-6xl leading-[0.92] tracking-tight text-balance sm:text-8xl">
            A straightforward way to start.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/65">
            Ask about a vehicle, discuss a search, or tell us what is happening
            with your car. Your message reaches the relevant dealership queue.
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="container-shell grid gap-10 lg:grid-cols-[0.78fr_1.1fr] lg:items-start lg:gap-16">
          <div>
            <p className="text-xs font-extrabold tracking-[0.18em] text-brand uppercase">
              Speak, write or visit
            </p>
            <h2 className="mt-4 font-display text-5xl leading-none tracking-tight">
              We’re here to help.
            </h2>
            <div className="mt-8 grid gap-4">
              <a
                href={publicSiteConfig.phoneHref}
                className="group flex items-center gap-4 rounded-2xl border bg-white p-5 transition hover:border-brand"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Phone className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-xs font-bold text-foreground/45">
                    Telephone
                  </span>
                  <span className="mt-1 block font-extrabold group-hover:text-brand">
                    {publicSiteConfig.phone}
                  </span>
                </span>
              </a>
              <a
                href={`mailto:${publicSiteConfig.email}`}
                className="group flex items-center gap-4 rounded-2xl border bg-white p-5 transition hover:border-brand"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <Mail className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-foreground/45">
                    Email
                  </span>
                  <span className="mt-1 block truncate font-extrabold group-hover:text-brand">
                    {publicSiteConfig.email}
                  </span>
                </span>
              </a>
              <div className="flex items-center gap-4 rounded-2xl border bg-white p-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <MapPin className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-xs font-bold text-foreground/45">
                    Location
                  </span>
                  <span className="mt-1 block font-extrabold">
                    {publicSiteConfig.address}
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-white p-6">
              <h3 className="flex items-center gap-2 font-extrabold">
                <Clock3 className="size-5 text-brand" aria-hidden />
                Opening hours
              </h3>
              <dl className="mt-5 grid gap-3 text-sm">
                {publicSiteConfig.hours.map((row) => (
                  <div
                    key={row.days}
                    className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <dt className="text-foreground/55">{row.days}</dt>
                    <dd className="font-bold">{row.times}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-xs leading-5 text-foreground/45">
                Opening hours and contact details are managed in DealerOS
                settings and may vary on bank holidays.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center gap-4 border-b pb-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand text-white">
                <MessageSquareText className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-extrabold">Send a message</h2>
                <p className="mt-1 text-xs text-foreground/50">
                  We will route it to the right person.
                </p>
              </div>
            </div>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
