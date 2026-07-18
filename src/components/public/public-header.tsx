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
import { cn } from "@/lib/utils";

import {
  publicSiteConfig,
  type PublicSiteConfig,
} from "./site-config";

const navigation = [
  { href: "/cars", label: "Cars for sale" },
  { href: "/source-a-car", label: "Source a car" },
  { href: "/repairs", label: "Repairs & servicing" },
  { href: "/contact", label: "Contact" },
];

export function PublicHeader({
  config = publicSiteConfig,
}: {
  config?: PublicSiteConfig;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="relative z-50 border-b border-white/10 bg-[#121814] text-white">
      <div className="border-b border-white/10 bg-[#0c100e]">
        <div className="container-shell flex min-h-9 items-center justify-between gap-4 py-1 text-[11px] font-bold tracking-[0.08em] text-white/65 uppercase sm:text-xs">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-[#d7ad69]" aria-hidden />
            Carefully selected. Properly prepared.
          </span>
          <a
            className="hidden items-center gap-2 transition hover:text-white sm:inline-flex"
            href={config.phoneHref}
          >
            <Phone className="size-3.5" aria-hidden />
            {config.phone}
          </a>
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
              Independent motor specialists
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
          className="fixed inset-x-0 top-[117px] bottom-0 overflow-y-auto bg-[#121814] px-4 pb-8 lg:hidden"
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
                <a
                  href={config.phoneHref}
                  onClick={() => setOpen(false)}
                >
                  <Phone aria-hidden />
                  {config.phone}
                </a>
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
