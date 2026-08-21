import { ArrowRight, BadgeCheck, HeartHandshake, Search, ShieldCheck, Wrench, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PublicSiteConfig } from "@/components/public/site-config";
import { Button } from "@/components/ui/button";
import type { ThemeId } from "@/lib/themes";

const principles = [
  { icon: ShieldCheck, title: "Clear vehicle information", copy: "The useful details are presented plainly, with a direct route to ask anything that matters." },
  { icon: HeartHandshake, title: "A personal service", copy: "Speak with the dealership team from the first question through to collection and aftercare." },
  { icon: Wrench, title: "Practical support", copy: "Vehicle sourcing and workshop support keep the relationship useful beyond a single sale." },
] as const;

function PrincipleGrid() {
  return <div className="grid gap-5 md:grid-cols-3">{principles.map((item, index) => <article key={item.title} className="theme-about-principle border bg-surface p-7"><span className="text-xs font-black text-brand">0{index + 1}</span><item.icon className="mt-5 size-6 text-brand" aria-hidden /><h2 className="mt-5 text-xl font-extrabold">{item.title}</h2><p className="mt-3 text-sm leading-7 text-foreground/72">{item.copy}</p></article>)}</div>;
}

function ClassicAbout({ config }: { config: PublicSiteConfig }) {
  return <><section className="bg-[#15221d] py-16 text-white sm:py-24"><div className="container-shell grid gap-10 lg:grid-cols-[1fr_0.75fr] lg:items-end"><div><p className="text-xs font-extrabold tracking-[0.18em] text-accent uppercase">About {config.name}</p><h1 className="mt-5 tracking-display-lg font-display text-6xl text-balance sm:text-8xl">Independent advice. Properly personal service.</h1></div><p className="text-base leading-8 text-white/75">{config.strapline} The team is here to make choosing, buying and looking after a vehicle feel straightforward.</p></div></section><section className="py-16 sm:py-24"><div className="container-shell"><PrincipleGrid /></div></section><AboutCta config={config} /></>;
}

function MarketplaceAbout({ config }: { config: PublicSiteConfig }) {
  return <><section className="border-b bg-surface py-14 sm:py-20"><div className="container-shell grid gap-10 lg:grid-cols-2 lg:items-center"><div><p className="font-extrabold text-brand">Meet {config.name}</p><h1 className="mt-4 text-6xl font-extrabold tracking-[-0.06em] text-balance sm:text-7xl">A better way to find your next car.</h1><p className="mt-6 text-lg leading-8 text-foreground/72">{config.strapline} Browse clearly, compare confidently and contact the people who know the stock.</p><Button asChild className="mt-7"><Link href="/cars">Browse current stock <ArrowRight aria-hidden /></Link></Button></div><div className="grid grid-cols-2 gap-3 rounded-3xl bg-background p-5"><div className="col-span-2 rounded-2xl bg-brand p-6 text-[var(--text-on-brand)]"><Search className="size-6" aria-hidden /><p className="mt-8 text-2xl font-extrabold">Search-led, not sales-led.</p></div><div className="rounded-2xl bg-surface p-5"><BadgeCheck className="size-5 text-brand" aria-hidden /><p className="mt-5 font-bold">Clear details</p></div><div className="rounded-2xl bg-surface p-5"><HeartHandshake className="size-5 text-brand" aria-hidden /><p className="mt-5 font-bold">Direct support</p></div></div></div></section><section className="py-16"><div className="container-shell"><PrincipleGrid /></div></section></>;
}

function PrestigeAbout({ config }: { config: PublicSiteConfig }) {
  return <><section className="relative isolate min-h-[68vh] overflow-hidden"><Image src={config.heroImageUrl} alt={config.heroImageAlt} fill priority sizes="100vw" className="object-cover opacity-40" /><div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" /><div className="container-shell relative flex min-h-[68vh] items-end py-20"><div className="max-w-5xl"><p className="text-xs font-bold tracking-[0.3em] text-accent uppercase">The house of {config.name}</p><h1 className="mt-6 font-display text-6xl leading-none text-balance sm:text-8xl">Selection is where service begins.</h1></div></div></section><section className="py-20 sm:py-28"><div className="container-shell grid gap-12 lg:grid-cols-[0.7fr_1.3fr]"><p className="font-display text-4xl leading-tight">{config.strapline}</p><div><p className="max-w-2xl text-lg leading-9 text-foreground/72">Every enquiry deserves attention to detail. Discover the collection at your pace, then speak directly with the team when the time is right.</p><div className="mt-12"><PrincipleGrid /></div></div></div></section></>;
}

function PerformanceAbout({ config }: { config: PublicSiteConfig }) {
  return <><section className="relative overflow-hidden bg-[#111214] py-20 text-white sm:py-28"><div className="absolute right-0 top-0 h-full w-1/3 skew-x-[-12deg] bg-brand/25" /><div className="container-shell relative"><p className="inline-flex items-center gap-2 text-xs font-black tracking-[0.22em] text-accent uppercase"><Zap className="size-4" aria-hidden />About {config.name}</p><h1 className="mt-6 max-w-5xl text-6xl font-black leading-[0.9] tracking-[-0.065em] uppercase sm:text-8xl">Knowledge. Detail. Momentum.</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-white/75">{config.strapline}</p></div></section><section className="py-16 sm:py-24"><div className="container-shell"><div className="mb-8 border-b-4 border-foreground pb-5"><h2 className="text-4xl font-black tracking-[-0.05em] uppercase sm:text-5xl">How the team works</h2></div><PrincipleGrid /><div className="mt-10 flex flex-wrap gap-3"><Button asChild><Link href="/cars">View vehicles <ArrowRight aria-hidden /></Link></Button><Button asChild variant="outline"><Link href="/contact">Speak to the team</Link></Button></div></div></section></>;
}

function AboutCta({ config }: { config: PublicSiteConfig }) {
  return <section className="pb-16 sm:pb-24"><div className="container-shell"><div className="rounded-3xl bg-foreground p-8 text-background sm:p-12"><h2 className="font-display text-4xl">Come and meet {config.name}.</h2><p className="mt-4 max-w-2xl leading-7 opacity-75">Browse the current vehicles, share a sourcing brief or contact the dealership directly.</p><div className="mt-7 flex flex-wrap gap-3"><Button asChild><Link href="/cars">See our cars</Link></Button><Button asChild variant="outline"><Link href="/find-us">Find us</Link></Button></div></div></div></section>;
}

export function ThemeAboutPage({ themeId, config }: { themeId: ThemeId; config: PublicSiteConfig }) {
  if (themeId === "modern-marketplace") return <MarketplaceAbout config={config} />;
  if (themeId === "prestige") return <PrestigeAbout config={config} />;
  if (themeId === "performance") return <PerformanceAbout config={config} />;
  return <ClassicAbout config={config} />;
}
