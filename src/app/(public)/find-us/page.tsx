import type { Metadata } from "next";
import Link from "next/link";
import {
  Car,
  Clock3,
  Mail,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { getPublicSiteConfig } from "@/lib/data/site-config";
import { getPublicContactDetails } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Find us",
  description:
    "Directions, opening times and contact details for our dealership. Open Google Maps for turn-by-turn directions.",
};

export default async function FindUsPage() {
  const siteConfig = await getPublicSiteConfig();
  const contact = getPublicContactDetails(siteConfig);
  const address = contact.address ?? siteConfig.name;
  const encodedAddress = encodeURIComponent(address);
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
  const mapLinkUrl = `https://www.google.com/maps?q=${encodedAddress}`;

  return (
    <>
      <section className="relative overflow-hidden bg-[#15221d] py-16 text-white sm:py-24">
        <div className="absolute -top-40 right-0 size-[36rem] rounded-full bg-[#d7ad69]/10 blur-3xl" />
        <div className="container-shell relative grid gap-12 lg:grid-cols-[1fr_0.75fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
              <MapPin className="size-4" aria-hidden />
              Find us
            </p>
            <h1 className="mt-5 max-w-4xl tracking-display-lg font-display text-6xl text-balance sm:text-8xl">
              Pop in.
              <span className="block text-[#e3bd7e]">We&apos;ll put the kettle on.</span>
            </h1>
            {contact.address ? (
              <p className="mt-6 max-w-xl text-base leading-8 text-white/70">
                {contact.address}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-sheen inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#d7ad69] px-6 text-sm font-extrabold text-[#171814] transition hover:bg-[#e3bd7e]"
            >
              <Navigation className="size-5" aria-hidden />
              Get directions
            </a>
            {contact.phone && contact.phoneHref ? (
              <a
                href={contact.phoneHref}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/[0.06] px-6 text-sm font-extrabold text-white transition hover:bg-white/10"
              >
                <Phone className="size-5" aria-hidden />
                {contact.phone}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-b bg-white py-10 sm:py-14">
        <div className="container-shell">
          <div className="overflow-hidden rounded-3xl border shadow-[0_18px_50px_rgba(15,24,18,0.08)]">
            <iframe
              title={`Map showing the location of ${siteConfig.name}`}
              src={mapEmbedUrl}
              className="aspect-[16/9] w-full border-0 sm:aspect-[21/9]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen"
            />
          </div>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 text-xs text-foreground/50 sm:flex-row">
            <p className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand" aria-hidden />
              Map is provided by Google Maps.
            </p>
            <a
              href={mapLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold text-brand underline decoration-brand/40 underline-offset-2"
            >
              Open in Google Maps
            </a>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="container-shell grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-start">
          <div>
            <p className="text-xs font-extrabold tracking-[0.18em] text-brand uppercase">
              Speak to the dealership
            </p>
            <h2 className="mt-4 tracking-display-lg font-display text-4xl text-balance sm:text-5xl">
              Talk before you travel.
            </h2>
            <p className="mt-4 text-base leading-8 text-foreground/65">
              If you&apos;re making a special trip to see a specific car, give
              us a quick call so we can have it front and centre when you
              arrive.
            </p>

            <div className="mt-8 grid gap-3">
              {contact.phone && contact.phoneHref ? (
                <a
                  href={contact.phoneHref}
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
                      {contact.phone}
                    </span>
                  </span>
                </a>
              ) : null}
              {contact.email && contact.emailHref ? (
                <a
                  href={contact.emailHref}
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
                      {contact.email}
                    </span>
                  </span>
                </a>
              ) : null}
              {contact.address ? (
                <a
                  href={mapLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-2xl border bg-white p-5 transition hover:border-brand"
                >
                  <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-xs font-bold text-foreground/45">
                      Location
                    </span>
                    <span className="mt-1 block font-extrabold group-hover:text-brand">
                      {contact.address}
                    </span>
                  </span>
                </a>
              ) : null}
            </div>

            <div className="mt-6 rounded-2xl border border-brand/20 bg-brand-soft/40 p-5">
              <p className="flex items-start gap-3 text-sm leading-6 text-brand-strong">
                <Car className="mt-0.5 size-5 shrink-0" aria-hidden />
                Off-street customer parking on site. If it&apos;s busy, we
                usually have space around the corner too.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8 lg:p-10">
            <h3 className="flex items-center gap-2 font-extrabold">
              <Clock3 className="size-5 text-brand" aria-hidden />
              Opening hours
            </h3>
            {contact.hours.length > 0 ? (
              <>
                <dl className="mt-6 grid gap-3 text-sm">
                  {contact.hours.map((row) => (
                    <div
                      key={row.days}
                      className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <dt className="text-foreground/55">{row.days}</dt>
                      <dd className="font-extrabold tabular-nums">{row.times}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-6 text-xs leading-5 text-foreground/45">
                  Opening hours may vary on bank holidays and around Christmas.
                  Message us if you need a specific time outside of these
                  hours.
                </p>
              </>
            ) : (
              <p className="mt-6 text-sm leading-6 text-foreground/60">
                Opening hours have not been published yet.{" "}
                <Link
                  href="/contact"
                  className="font-extrabold text-brand underline decoration-brand/40 underline-offset-2"
                >
                  Send us a message
                </Link>{" "}
                to arrange a suitable time.
              </p>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-sheen inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-extrabold text-white transition hover:bg-brand-strong"
              >
                <Navigation className="size-4" aria-hidden />
                Get directions
              </a>
              <Link
                href="/contact"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-extrabold text-foreground transition hover:border-brand"
              >
                Send a message
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
