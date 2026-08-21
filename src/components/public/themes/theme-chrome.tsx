"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  ChevronRight,
  Clock3,
  Mail,
  MapPin,
  Menu,
  Phone,
  Search,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { PublicSiteConfig } from "@/components/public/site-config";
import { Button } from "@/components/ui/button";
import { getPublicContactDetails } from "@/lib/public-contact";
import { getSiteLogoInitial } from "@/lib/site-metadata";
import type { ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/cars", label: "Cars" },
  { href: "/source-a-car", label: "Source a car" },
  { href: "/part-exchange", label: "Part exchange" },
  { href: "/finance", label: "Finance" },
  { href: "/services", label: "Workshop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

function Logo({ config, dark = false }: { config: PublicSiteConfig; dark?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${config.name} home`}>
      {config.logoUrl ? (
        <Image
          src={config.logoUrl}
          alt={config.name}
          width={420}
          height={140}
          priority
          className="h-10 w-auto max-w-52 object-contain sm:h-12 sm:max-w-64"
        />
      ) : (
        <>
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-lg font-black text-[var(--text-on-brand)]", dark && "rounded-none border border-accent/60 bg-transparent font-display text-accent")}>
            {getSiteLogoInitial(config.name)}
          </span>
          <span className={cn("truncate text-lg font-extrabold tracking-[-0.03em]", dark && "font-display text-2xl font-medium tracking-normal")}>{config.name}</span>
        </>
      )}
    </Link>
  );
}

function DesktopNavigation({ themeId }: { themeId: ThemeId }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="hidden lg:block">
      <ul className={cn("flex items-center", themeId === "prestige" ? "gap-7" : "gap-6")}>
        {navigation.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-2 text-sm font-bold transition hover:text-brand",
                  themeId === "prestige" && "text-xs tracking-[0.14em] uppercase hover:text-accent",
                  themeId === "performance" && "font-black tracking-[0.08em] uppercase",
                  active && themeId !== "prestige" && "text-brand after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-brand",
                  active && themeId === "prestige" && "text-accent",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MobileNavigation({ config }: { config: PublicSiteConfig }) {
  const contact = getPublicContactDetails(config);
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="grid size-11 shrink-0 place-items-center rounded-xl border lg:hidden" aria-label="Open navigation">
          <Menu aria-hidden />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/65 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[111] flex w-[min(92vw,420px)] flex-col overflow-y-auto bg-background p-5 text-foreground shadow-2xl" aria-describedby={undefined}>
          <div className="flex items-center justify-between gap-4 border-b pb-5">
            <Dialog.Title className="text-sm font-extrabold">Explore {config.name}</Dialog.Title>
            <Dialog.Close className="grid size-11 place-items-center rounded-xl border" aria-label="Close navigation"><X aria-hidden /></Dialog.Close>
          </div>
          <nav aria-label="Mobile navigation" className="mt-4">
            <ul>
              {navigation.map((item) => (
                <li key={item.href} className="border-b">
                  <Dialog.Close asChild>
                    <Link href={item.href} className="flex min-h-14 items-center justify-between py-3 text-lg font-extrabold">
                      {item.label}<ChevronRight className="size-5 text-brand" aria-hidden />
                    </Link>
                  </Dialog.Close>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto grid gap-3 pt-8">
            <Button asChild size="lg"><Link href="/cars"><Search aria-hidden /> Browse stock</Link></Button>
            {contact.phone && contact.phoneHref ? <Button asChild size="lg" variant="outline"><a href={contact.phoneHref}><Phone aria-hidden /> {contact.phone}</a></Button> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MarketplaceHeader({ config }: { config: PublicSiteConfig }) {
  const contact = getPublicContactDetails(config);
  return (
    <header className="theme-header-marketplace sticky top-0 z-50 border-b bg-surface/95 text-foreground shadow-sm backdrop-blur">
      <div className="border-b bg-background"><div className="container-shell flex min-h-9 items-center justify-between gap-4 text-xs font-semibold"><span>Independent vehicle specialists</span>{contact.phone && contact.phoneHref ? <a href={contact.phoneHref} className="font-extrabold text-brand">Call {contact.phone}</a> : <Link href="/contact" className="font-extrabold text-brand">Contact the team</Link>}</div></div>
      <div className="container-shell flex min-h-20 items-center justify-between gap-6">
        <Logo config={config} />
        <DesktopNavigation themeId="modern-marketplace" />
        <div className="hidden items-center gap-2 lg:flex"><Button asChild variant="ghost"><Link href="/cars"><Search aria-hidden /> Search</Link></Button><Button asChild><Link href="/contact">Enquire <ArrowRight aria-hidden /></Link></Button></div>
        <MobileNavigation config={config} />
      </div>
    </header>
  );
}

function PrestigeHeader({ config }: { config: PublicSiteConfig }) {
  return (
    <header className="theme-header-prestige sticky top-0 z-50 border-b border-white/10 bg-background/95 text-foreground backdrop-blur-xl">
      <div className="container-shell grid min-h-24 grid-cols-[1fr_auto] items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <div className="hidden text-xs tracking-[0.2em] text-foreground/70 uppercase lg:block">Motor collection</div>
        <Logo config={config} dark />
        <div className="flex items-center justify-end"><DesktopNavigation themeId="prestige" /><MobileNavigation config={config} /></div>
      </div>
    </header>
  );
}

function PerformanceHeader({ config }: { config: PublicSiteConfig }) {
  return (
    <header className="theme-header-performance sticky top-0 z-50 bg-[#111214] text-white shadow-lg">
      <div className="h-1 bg-brand" />
      <div className="container-shell flex min-h-20 items-center justify-between gap-6">
        <div className="flex items-center gap-3"><Zap className="hidden size-5 text-accent sm:block" aria-hidden /><Logo config={config} /></div>
        <DesktopNavigation themeId="performance" />
        <Button asChild className="hidden lg:inline-flex"><Link href="/cars">View machines <ArrowRight aria-hidden /></Link></Button>
        <MobileNavigation config={config} />
      </div>
    </header>
  );
}

export function AlternateThemeHeader({ config, themeId }: { config: PublicSiteConfig; themeId: Exclude<ThemeId, "direct-motors-classic"> }) {
  if (themeId === "modern-marketplace") return <MarketplaceHeader config={config} />;
  if (themeId === "prestige") return <PrestigeHeader config={config} />;
  return <PerformanceHeader config={config} />;
}

export function AlternateThemeFooter({ config, themeId }: { config: PublicSiteConfig; themeId: Exclude<ThemeId, "direct-motors-classic"> }) {
  const contact = getPublicContactDetails(config);
  const prestige = themeId === "prestige";
  const performance = themeId === "performance";
  return (
    <footer className={cn("theme-footer border-t bg-surface text-foreground", prestige && "bg-background", performance && "border-t-4 border-brand bg-[#111214] text-white")}>
      <div className={cn("container-shell grid gap-10 py-14 lg:grid-cols-[1.2fr_0.8fr_0.8fr]", prestige && "py-20 lg:grid-cols-[1.35fr_0.65fr_1fr]")}>
        <div><Logo config={config} dark={prestige} /><p className="mt-5 max-w-md text-sm leading-7 opacity-70">{config.strapline}</p>{performance ? <p className="mt-6 inline-flex items-center gap-2 border-l-4 border-brand pl-4 text-xs font-black tracking-[0.15em] uppercase"><Zap className="size-4 text-accent" aria-hidden /> Built around the drive</p> : null}</div>
        <div><h2 className={cn("text-xs font-extrabold tracking-[0.16em] text-brand uppercase", prestige && "text-accent")}>Explore</h2><ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm font-semibold lg:grid-cols-1">{navigation.map((item) => <li key={item.href}><Link href={item.href} className="transition hover:text-brand">{item.label}</Link></li>)}</ul></div>
        <div><h2 className={cn("text-xs font-extrabold tracking-[0.16em] text-brand uppercase", prestige && "text-accent")}>Visit or enquire</h2><ul className="mt-5 grid gap-4 text-sm leading-6 opacity-75">{contact.phones.slice(0, 2).map((phone) => <li key={phone.href} className="flex gap-3"><Phone className="mt-1 size-4 shrink-0 text-brand" aria-hidden /><a href={phone.href}>{phone.label}</a></li>)}{contact.email && contact.emailHref ? <li className="flex gap-3"><Mail className="mt-1 size-4 shrink-0 text-brand" aria-hidden /><a href={contact.emailHref} className="break-all">{contact.email}</a></li> : null}{contact.address ? <li className="flex gap-3"><MapPin className="mt-1 size-4 shrink-0 text-brand" aria-hidden /><span>{contact.address}</span></li> : null}{contact.hours[0] ? <li className="flex gap-3"><Clock3 className="mt-1 size-4 shrink-0 text-brand" aria-hidden /><span>{contact.hours[0].days} {contact.hours[0].times}</span></li> : null}</ul></div>
      </div>
      <div className="border-t"><div className="container-shell flex flex-col gap-4 py-6 text-xs opacity-65 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} {config.name}. All rights reserved.</p><nav aria-label="Legal links" className="flex gap-5"><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><Link href="/terms">Terms</Link></nav></div></div>
    </footer>
  );
}
