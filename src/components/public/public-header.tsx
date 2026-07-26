"use client";

import {
  ChevronRight,
  Menu,
  Phone,
  ShieldCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getPublicContactDetails } from "@/lib/public-contact";
import { cn } from "@/lib/utils";

import {
  publicSiteConfig,
  type PublicSiteConfig,
} from "./site-config";

const navigation = [
  { href: "/cars", label: "Cars for sale" },
  { href: "/source-a-car", label: "Source a car" },
  { href: "/part-exchange", label: "Part exchange" },
  { href: "/finance", label: "Finance" },
  { href: "/services", label: "MOT & servicing" },
  { href: "/contact", label: "Contact" },
];

export function PublicHeader({
  config = publicSiteConfig,
}: {
  config?: PublicSiteConfig;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const contact = getPublicContactDetails(config);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "material-dark sticky -top-[37px] z-50 text-white transition-[border-color,box-shadow] duration-300 ease-out",
        scrolled
          ? "border-b border-white/10 shadow-[0_10px_30px_rgba(6,10,8,0.28)]"
          : "border-b border-transparent",
        open && "z-[90]",
      )}
    >
      <div className="border-b border-white/10 bg-black/25">
        <div className="container-shell flex min-h-9 items-center justify-center gap-3 py-1 text-[11px] font-bold tracking-[0.12em] text-white/65 uppercase sm:text-xs">
          <ShieldCheck className="size-3.5 text-[#d7ad69]" aria-hidden />
          Carefully selected. Properly prepared.
        </div>
      </div>

      <div className="container-shell grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-5 sm:py-7">
        <div className="hidden min-w-0 items-center gap-3 text-[11px] font-extrabold tracking-[0.16em] text-white/55 uppercase lg:inline-flex">
          <span className="h-px w-8 bg-[#d7ad69]/50" aria-hidden />
          Independent motor specialists
        </div>

        <Link
          href="/"
          className="group flex items-center justify-center"
          aria-label={`${config.name} home`}
        >
          {config.logoUrl ? (
            <Image
              src={config.logoUrl}
              alt={config.name}
              width={1000}
              height={320}
              priority
              className="h-16 w-auto max-w-[280px] object-contain transition group-hover:opacity-90 sm:h-24 sm:max-w-[440px] lg:h-28 lg:max-w-[520px]"
            />
          ) : (
            <span className="font-display text-3xl tracking-tight text-white sm:text-5xl">
              {config.name}
            </span>
          )}
        </Link>

        <div className="flex items-center justify-end gap-3">
          {contact.phone && contact.phoneHref ? (
            <a
              href={contact.phoneHref}
              className="hidden items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-white/10 lg:inline-flex"
            >
              <Phone className="size-4 text-[#d7ad69]" aria-hidden />
              {contact.phone}
            </a>
          ) : (
            <Button
              asChild
              className="hidden bg-[#d7ad69] text-[#171814] hover:bg-[#e3bd7e] lg:inline-flex"
            >
              <Link href="/contact">
                Talk to us
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          )}
          <button
            type="button"
            className="grid size-11 place-items-center rounded-xl border border-white/20 text-white transition hover:bg-white/10 lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close navigation" : "Open navigation"}
          >
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>
      </div>

      <nav
        aria-label="Main navigation"
        className="hidden border-t border-white/10 bg-black/30 lg:block"
      >
        <div className="container-shell flex items-center justify-center gap-8 py-3">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative py-1.5 text-sm font-bold tracking-wide text-white/70 uppercase transition hover:text-white",
                  active &&
                    "text-white after:absolute after:inset-x-0 after:-bottom-2 after:h-0.5 after:bg-[#d7ad69]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {open ? (
        <div
          id="mobile-navigation"
          className="material-dark absolute inset-x-0 top-full h-[calc(100dvh-5rem)] overflow-y-auto px-4 pb-8 lg:hidden"
        >
          <nav
            aria-label="Mobile navigation"
            className="container-shell flex flex-col border-t border-white/10 pt-4"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-14 items-center justify-between border-b border-white/10 py-3 text-lg font-bold"
              >
                {item.label}
                <ChevronRight className="text-[#d7ad69]" aria-hidden />
              </Link>
            ))}
            <div className="mt-6 grid gap-3">
              <Button
                asChild
                variant="outline"
                className="border-white/25 text-white hover:bg-white/10"
              >
                <Link href="/book-repair-call" onClick={() => setOpen(false)}>
                  Book a repair call
                </Link>
              </Button>
              <Button
                asChild
                className="bg-[#d7ad69] text-[#171814] hover:bg-[#e3bd7e]"
              >
                {contact.phone && contact.phoneHref ? (
                  <a href={contact.phoneHref} onClick={() => setOpen(false)}>
                    <Phone aria-hidden />
                    {contact.phone}
                  </a>
                ) : (
                  <Link href="/contact" onClick={() => setOpen(false)}>
                    Send us a message
                    <ChevronRight aria-hidden />
                  </Link>
                )}
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
