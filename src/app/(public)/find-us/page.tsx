import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Clock3,
  Navigation,
  Phone,
  Smartphone,
} from "lucide-react";

import { getPublicSiteConfig } from "@/lib/data/site-config";
import { getPublicContactDetails } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Find us",
  description:
    "Directions, opening times and phone numbers for our dealership. Open Google Maps for turn-by-turn directions.",
};

const dayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function todayKey() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "Europe/London",
  })
    .format(new Date())
    .toLowerCase();
}

function phoneIcon(index: number) {
  return index === 0 ? Phone : Smartphone;
}

export default async function FindUsPage() {
  const siteConfig = await getPublicSiteConfig();
  const contact = getPublicContactDetails(siteConfig);
  const address = contact.address ?? siteConfig.name;
  const encodedAddress = encodeURIComponent(address);
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;

  const phones = [
    contact.phone && contact.phoneHref
      ? { label: contact.phone, href: contact.phoneHref }
      : null,
  ].filter((entry): entry is { label: string; href: string } => Boolean(entry));

  const hoursByDay = new Map(
    contact.hours.map((row) => [row.days.toLowerCase(), row]),
  );
  const orderedHours =
    contact.hours.length > 0
      ? dayOrder
          .map((key) => hoursByDay.get(key))
          .filter((row): row is { days: string; times: string } => Boolean(row))
      : [];
  const today = todayKey();

  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#0d1210] text-white">
        <Image
          src={siteConfig.heroImageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,15,12,0.35)_0%,rgba(10,15,12,0.55)_100%)]" />
        <div className="container-shell relative flex min-h-[300px] items-center justify-center py-16 sm:min-h-[360px] sm:py-24">
          <div className="text-center">
            <h1 className="font-display text-4xl font-extrabold tracking-[0.14em] uppercase text-white sm:text-5xl lg:text-6xl">
              Find {siteConfig.name}
            </h1>
            <div
              aria-hidden
              className="mx-auto mt-5 h-[3px] w-24 rounded-full bg-[#d7ad69] shadow-[0_0_18px_rgba(215,173,105,0.6)]"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#0d1210]">
        <iframe
          title={`Map showing the location of ${siteConfig.name}`}
          src={mapEmbedUrl}
          className="h-[420px] w-full border-0 sm:h-[520px]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="fullscreen"
        />
      </section>

      <section className="bg-[#f4f2ec] py-14 sm:py-20">
        <div className="container-shell">
          <div className="rounded-3xl bg-white p-8 shadow-[0_10px_40px_rgba(15,24,18,0.05)] sm:p-12 lg:p-14">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  Phone Us On:
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-[3px] w-16 rounded-full bg-[#d7ad69]"
                />

                {phones.length > 0 ? (
                  <ul className="mt-8 grid gap-3 text-lg font-extrabold sm:text-xl">
                    {phones.map((entry, index) => {
                      const Icon = phoneIcon(index);
                      return (
                        <li key={entry.href}>
                          <a
                            href={entry.href}
                            className="group inline-flex items-center gap-4 transition hover:text-brand"
                          >
                            <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
                              <Icon className="size-5" aria-hidden />
                            </span>
                            {entry.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-8 text-sm leading-6 text-foreground/60">
                    Direct telephone numbers have not been published yet.{" "}
                    <Link
                      href="/contact"
                      className="font-extrabold text-brand underline decoration-brand/40 underline-offset-2"
                    >
                      Send us a message
                    </Link>{" "}
                    and the team will get in touch.
                  </p>
                )}

                {contact.address ? (
                  <>
                    <p className="mt-10 text-xs font-extrabold tracking-[0.16em] text-foreground/45 uppercase">
                      Our address
                    </p>
                    <p className="mt-3 text-base leading-7 font-bold text-foreground/85">
                      {contact.address}
                    </p>
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cta-sheen mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-extrabold text-white transition hover:bg-brand-strong"
                    >
                      <Navigation className="size-4" aria-hidden />
                      Get directions
                    </a>
                  </>
                ) : null}
              </div>

              <div>
                <h2 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight">
                  <Clock3 className="size-6 text-brand" aria-hidden />
                  Our Opening Hours Are:
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-[3px] w-16 rounded-full bg-[#d7ad69]"
                />

                {orderedHours.length > 0 ? (
                  <dl className="mt-8 divide-y overflow-hidden rounded-2xl border">
                    {orderedHours.map((row) => {
                      const isToday = row.days.toLowerCase() === today;
                      return (
                        <div
                          key={row.days}
                          className={
                            isToday
                              ? "flex items-center justify-between gap-4 bg-[#171814] px-5 py-4 text-white"
                              : "flex items-center justify-between gap-4 px-5 py-4"
                          }
                        >
                          <dt
                            className={
                              isToday
                                ? "text-sm font-extrabold tracking-[0.16em] uppercase"
                                : "text-sm font-extrabold tracking-[0.16em] text-foreground/80 uppercase"
                            }
                          >
                            {row.days}
                          </dt>
                          <dd
                            className={
                              isToday
                                ? "text-sm font-extrabold tracking-wide tabular-nums uppercase"
                                : "text-sm font-extrabold tracking-wide text-foreground tabular-nums uppercase"
                            }
                          >
                            {row.times}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                ) : (
                  <p className="mt-8 text-sm leading-6 text-foreground/60">
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

                <p className="mt-6 text-xs leading-5 text-foreground/45">
                  Opening hours may vary on bank holidays and around
                  Christmas. Please call ahead if you&apos;re making a special
                  trip.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
