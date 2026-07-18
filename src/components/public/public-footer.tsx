import {
  ArrowUpRight,
  Clock3,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { getPublicContactDetails } from "@/lib/public-contact";
import { getSiteLogoInitial } from "@/lib/site-metadata";

import {
  publicSiteConfig,
  type PublicSiteConfig,
} from "./site-config";

const footerLinks = [
  { href: "/cars", label: "Cars for sale" },
  { href: "/source-a-car", label: "Source a car" },
  { href: "/repairs", label: "Repairs & servicing" },
  { href: "/book-repair-call", label: "Book a repair call" },
  { href: "/contact", label: "Contact us" },
];

export function PublicFooter({
  config = publicSiteConfig,
}: {
  config?: PublicSiteConfig;
}) {
  const contact = getPublicContactDetails(config);

  return (
    <footer className="bg-[#101512] text-white">
      <div className="container-shell grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_1fr] lg:py-20">
        <div>
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-3"
            aria-label={`${config.name} home`}
          >
            <span className="grid size-11 place-items-center rounded-full border border-[#d7ad69]/50 bg-[#d7ad69]/10 font-display text-2xl text-[#e7c387]">
              {getSiteLogoInitial(config.name)}
            </span>
            <span className="text-xl font-extrabold">
              {config.name}
            </span>
          </Link>
          <p className="max-w-md text-sm leading-7 text-white/60">
            {config.strapline} Quality used cars, considered sourcing
            and trusted workshop support from one independent team.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70">
            <ShieldCheck className="size-4 text-[#d7ad69]" aria-hidden />
            Specifications independently checked before handover
          </div>
        </div>

        <div>
          <h2 className="mb-5 text-xs font-extrabold tracking-[0.16em] text-[#d7ad69] uppercase">
            Explore
          </h2>
          <ul className="grid gap-3 text-sm font-semibold text-white/70">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link
                  className="inline-flex items-center gap-1 transition hover:text-white"
                  href={link.href}
                >
                  {link.label}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-5 text-xs font-extrabold tracking-[0.16em] text-[#d7ad69] uppercase">
            Contact the team
          </h2>
          <ul className="grid gap-4 text-sm leading-6 text-white/65">
            {contact.phone && contact.phoneHref ? (
              <li className="flex gap-3">
                <Phone className="mt-1 size-4 shrink-0 text-[#d7ad69]" aria-hidden />
                <a className="hover:text-white" href={contact.phoneHref}>
                  {contact.phone}
                </a>
              </li>
            ) : null}
            {contact.email && contact.emailHref ? (
              <li className="flex gap-3">
                <Mail className="mt-1 size-4 shrink-0 text-[#d7ad69]" aria-hidden />
                <a
                  className="break-all hover:text-white"
                  href={contact.emailHref}
                >
                  {contact.email}
                </a>
              </li>
            ) : null}
            {contact.address ? (
              <li className="flex gap-3">
                <MapPin className="mt-1 size-4 shrink-0 text-[#d7ad69]" aria-hidden />
                <span>{contact.address}</span>
              </li>
            ) : null}
            {contact.hours.length > 0 ? (
              <li className="flex gap-3">
                <Clock3 className="mt-1 size-4 shrink-0 text-[#d7ad69]" aria-hidden />
                <span>
                  {contact.hours
                    .slice(0, 3)
                    .map((row) => `${row.days} ${row.times}`)
                    .join(" · ")}
                </span>
              </li>
            ) : null}
            <li className="flex gap-3">
              <MessageSquareText
                className="mt-1 size-4 shrink-0 text-[#d7ad69]"
                aria-hidden
              />
              <Link className="hover:text-white" href="/contact">
                {contact.phone || contact.email
                  ? "Send us a message"
                  : "Use our contact form to reach the team"}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-shell flex flex-col gap-4 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {config.name}. All rights
            reserved.
          </p>
          <nav aria-label="Legal links" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="hover:text-white" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-white" href="/cookies">
              Cookies
            </Link>
            <Link className="hover:text-white" href="/terms">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
