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
  { href: "/cars", label: "Our cars" },
  { href: "/source-a-car", label: "Find me a car" },
  { href: "/repairs", label: "Workshop" },
  { href: "/contact", label: "Get in touch" },
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
        <div className="container-shell flex min-h-9 items-center justify-between gap-4 py-1 text-[11px] font-bold tracking-[0.08em] text-white/65 uppercase sm:text-xs">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-[#d7ad69]" aria-hidden />
            Family-run · Local · Honest
          </span>
          {contact.phone && contact.phoneHref ? (
            <a
              className="hidden items-center gap-2 transition hover:text-white sm:inline-flex"
              href={contact.phoneHref}
            >
              <Phone className="size-3.5" aria-hidden />
              {contact.phone}
            </a>
          ) : (
            <Link
              className="hidden items-center gap-2 transition hover:text-white sm:inline-flex"
              href="/contact"
            >
              Contact the dealership
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <div className="container-shell flex h-20 items-center justify-between gap-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-3"
          aria-label={`${config.name} home`}
        >
          <span className="grid size-10 place-items-center rounded-full border border-[#d7ad69]/50 bg-[#d7ad69]/10 font-display text-xl text-[#e7c387] transition group-hover:bg-[#d7ad69]/20">
            {config.logoUrl ? (
              <Image
                src={config.logoUrl}
                alt=""
                width={40}
                height={40}
                className="size-full rounded-full object-contain"
              />
            ) : (
              config.name.slice(0, 1).toUpperCase()
            )}
          </span>
          <span>
            <span className="block text-lg font-extrabold tracking-tight">
              {config.name}
            </span>
            <span className="hidden text-[10px] font-semibold tracking-[0.12em] text-white/50 uppercase sm:block">
              Your friendly neighbourhood dealership
            </span>
          </span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 lg:flex"
        >
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative py-2 text-sm font-bold text-white/70 transition hover:text-white",
                  active &&
                    "text-white after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-[#d7ad69]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Button
            asChild
            variant="outline"
            className="border-white/25 text-white hover:bg-white/10"
          >
            <Link href="/book-repair-call">Book a repair call</Link>
          </Button>
          <Button
            asChild
            className="bg-[#d7ad69] text-[#171814] hover:bg-[#e3bd7e]"
          >
            <Link href="/contact">
              Talk to us
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>

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
