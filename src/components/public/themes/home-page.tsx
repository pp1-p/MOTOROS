import {
  ArrowRight,
  BadgeCheck,
  CarFront,
  ChevronRight,
  Gauge,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/public/section-heading";
import type { PublicSiteConfig } from "@/components/public/site-config";
import { VehicleCard } from "@/components/public/vehicle-card";
import { Button } from "@/components/ui/button";
import type { PublicVehicleRecord } from "@/lib/data/vehicles";
import type { ThemeId } from "@/lib/themes";

export type ThemeHomePageProps = {
  config: PublicSiteConfig;
  featuredVehicles: PublicVehicleRecord[];
};

function InventoryEmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`border bg-surface text-center ${compact ? "rounded-2xl p-7" : "rounded-3xl p-10"}`}>
      <CarFront className="mx-auto size-7 text-brand" aria-hidden />
      <h2 className="mt-4 text-xl font-extrabold">Fresh vehicles are being prepared</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-foreground/70">
        Tell the team what you need and they can search beyond the current forecourt.
      </p>
      <Button asChild className="mt-5">
        <Link href="/source-a-car">Start a vehicle search</Link>
      </Button>
    </div>
  );
}

function ClassicHome({ config, featuredVehicles }: ThemeHomePageProps) {
  return (
    <div className="theme-home theme-home-classic">
      <section className="relative isolate min-h-[650px] overflow-hidden bg-[#111713] text-white sm:min-h-[720px]">
        <Image
          src={config.heroImageUrl}
          alt={config.heroImageAlt}
          fill
          priority
          sizes="100vw"
          className="hero-zoom object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,15,12,0.94)_0%,rgba(10,15,12,0.73)_48%,rgba(10,15,12,0.25)_82%)]" />
        <div className="container-shell relative flex min-h-[650px] items-center py-20 sm:min-h-[720px]">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-4 py-2 text-xs font-extrabold tracking-[0.13em] text-white/90 uppercase backdrop-blur">
              <Sparkles className="size-4 text-accent" aria-hidden />
              {config.heroEyebrow}
            </p>
            <h1 className="tracking-display-lg font-display text-6xl text-balance sm:text-7xl lg:text-[6.25rem]">
              {config.heroHeadline}
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-white/80 sm:text-lg">
              {config.heroSummary}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="cta-sheen">
                <Link href={config.primaryHref}>
                  {config.primaryLabel}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/35 bg-black/20 text-white hover:bg-white/10">
                <Link href="/source-a-car">Ask us to find your car</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-white/15 bg-black/30 backdrop-blur-md">
          <div className="container-shell grid sm:grid-cols-3">
            {["Carefully selected", "Clearly presented", "Supported after sale"].map((label) => (
              <p key={label} className="border-white/10 px-5 py-4 text-center text-xs font-bold tracking-[0.1em] text-white/85 uppercase sm:border-l first:sm:border-l-0">
                {label}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="container-shell">
          <SectionHeading
            eyebrow="In stock now"
            title="Have a look around"
            description="A carefully presented selection with the details you need and a clear route to the dealership team."
            action={<Button asChild variant="outline"><Link href="/cars">View every car <ArrowRight aria-hidden /></Link></Button>}
          />
          {featuredVehicles.length ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {featuredVehicles.map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} priority={index < 2} />)}
            </div>
          ) : <div className="mt-10"><InventoryEmptyState /></div>}
        </div>
      </section>

      <section className="bg-[#10231f] py-20 text-white sm:py-28">
        <div className="container-shell grid gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="text-xs font-extrabold tracking-[0.16em] text-accent uppercase">More than a forecourt</p>
            <h2 className="mt-5 tracking-display-lg font-display text-5xl text-balance sm:text-6xl">A straightforward team for the whole journey.</h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/75">Browse available cars, ask for a tailored search, or speak to the workshop about keeping your vehicle at its best.</p>
          </div>
          <div className="grid gap-3">
            {[
              { href: "/source-a-car", icon: Search, title: "Personal car sourcing" },
              { href: "/services", icon: Wrench, title: "MOT, servicing and repairs" },
              { href: "/contact", icon: BadgeCheck, title: "Direct, useful advice" },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group flex items-center gap-4 rounded-2xl border border-white/15 bg-white/[0.05] p-5 transition hover:bg-white/10">
                <item.icon className="size-5 text-accent" aria-hidden />
                <span className="font-extrabold">{item.title}</span>
                <ChevronRight className="ml-auto size-5 transition group-hover:translate-x-1" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MarketplaceHome({ config, featuredVehicles }: ThemeHomePageProps) {
  return (
    <div className="theme-home theme-home-marketplace">
      <section className="border-b bg-surface py-12 sm:py-16 lg:py-20">
        <div className="container-shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-extrabold text-brand">{config.heroEyebrow}</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-extrabold tracking-[-0.055em] text-balance sm:text-7xl">{config.heroHeadline}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-foreground/75">{config.heroSummary}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link href="/cars">Browse all vehicles <ArrowRight aria-hidden /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/contact">Talk to the team</Link></Button>
            </div>
          </div>
          <form action="/cars" method="get" className="rounded-3xl border bg-background p-5 shadow-[0_24px_70px_rgba(16,32,59,0.12)] sm:p-7">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-brand text-[var(--text-on-brand)]"><Search className="size-5" aria-hidden /></span>
              <div><p className="font-extrabold">Search current stock</p><p className="text-sm text-foreground/65">Start broad, then narrow the results.</p></div>
            </div>
            <label className="mt-6 block text-sm font-bold">Make or model
              <input name="q" className="mt-2 h-12 w-full rounded-xl border bg-surface px-4 text-base" placeholder="e.g. Audi Q5" />
            </label>
            <label className="mt-4 block text-sm font-bold">Maximum price
              <select name="maxPrice" className="mt-2 h-12 w-full rounded-xl border bg-surface px-4 text-base">
                <option value="">Any price</option><option value="15000">Up to £15,000</option><option value="25000">Up to £25,000</option><option value="40000">Up to £40,000</option><option value="60000">Up to £60,000</option>
              </select>
            </label>
            <Button type="submit" size="lg" className="mt-5 w-full"><Search aria-hidden /> Search vehicles</Button>
          </form>
        </div>
      </section>

      <section className="border-b bg-background py-7">
        <div className="container-shell grid gap-3 sm:grid-cols-3">
          {[
            { icon: CarFront, label: `${featuredVehicles.length || "New"} featured vehicles` },
            { icon: ShieldCheck, label: "Clear vehicle information" },
            { icon: Search, label: "Personal sourcing available" },
          ].map((item) => <div key={item.label} className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm font-bold"><item.icon className="size-4 text-brand" aria-hidden />{item.label}</div>)}
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="container-shell">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-sm font-extrabold text-brand">Latest arrivals</p><h2 className="mt-2 text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">Find your next car</h2></div>
            <Link href="/cars" className="inline-flex items-center gap-2 text-sm font-extrabold text-brand">See the complete marketplace <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          {featuredVehicles.length ? <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{featuredVehicles.map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} priority={index < 2} />)}</div> : <div className="mt-8"><InventoryEmptyState compact /></div>}
        </div>
      </section>
    </div>
  );
}

function PrestigeHome({ config, featuredVehicles }: ThemeHomePageProps) {
  const lead = featuredVehicles[0];
  return (
    <div className="theme-home theme-home-prestige">
      <section className="relative isolate min-h-[76vh] overflow-hidden bg-background text-foreground">
        <Image src={config.heroImageUrl} alt={config.heroImageAlt} fill priority sizes="100vw" className="object-cover opacity-55" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,14,16,0.25),rgba(13,14,16,0.92))]" />
        <div className="container-shell relative flex min-h-[76vh] items-end justify-center py-20 text-center sm:py-28">
          <div className="max-w-5xl">
            <p className="text-xs font-bold tracking-[0.32em] text-accent uppercase">{config.heroEyebrow}</p>
            <h1 className="mt-7 font-display text-6xl leading-[0.94] text-balance sm:text-8xl lg:text-[7.5rem]">{config.heroHeadline}</h1>
            <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-foreground/80 sm:text-lg">{config.heroSummary}</p>
            <Link href="/cars" className="mt-9 inline-flex min-h-12 items-center gap-3 border-b border-accent px-2 text-sm font-bold tracking-[0.18em] uppercase">View the collection <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
        </div>
      </section>

      <section className="border-y py-20 sm:py-28">
        <div className="container-shell">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div className="lg:pb-12"><p className="text-xs font-bold tracking-[0.28em] text-accent uppercase">Curated stock</p><h2 className="mt-5 font-display text-5xl leading-none sm:text-6xl">Vehicles with presence.</h2><p className="mt-6 max-w-md leading-8 text-foreground/70">A considered collection, presented with space for the details and photography to speak.</p><Button asChild variant="outline" className="mt-8"><Link href="/cars">Explore every vehicle</Link></Button></div>
            {lead ? <div className="theme-prestige-lead"><VehicleCard vehicle={lead} priority /></div> : <InventoryEmptyState />}
          </div>
          {featuredVehicles.length > 1 ? <div className="mt-8 grid gap-6 md:grid-cols-3">{featuredVehicles.slice(1, 4).map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}</div> : null}
        </div>
      </section>

      <section className="bg-surface py-20 sm:py-28">
        <div className="container-shell grid gap-12 lg:grid-cols-2 lg:items-center">
          <p className="font-display text-4xl leading-tight text-balance sm:text-5xl">“The right car should feel considered before you ever turn the key.”</p>
          <div className="grid gap-6 border-l border-accent/45 pl-7"><p className="leading-8 text-foreground/72">Speak directly with {config.name} about a vehicle, a discreet sourcing brief, or the practical next step.</p><div className="flex flex-wrap gap-3"><Button asChild><Link href="/contact">Start a conversation</Link></Button><Button asChild variant="outline"><Link href="/source-a-car">Private sourcing</Link></Button></div></div>
        </div>
      </section>
    </div>
  );
}

function PerformanceHome({ config, featuredVehicles }: ThemeHomePageProps) {
  return (
    <div className="theme-home theme-home-performance">
      <section className="relative overflow-hidden bg-[#111214] text-white">
        <div className="container-shell grid min-h-[660px] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative z-10 flex min-w-0 items-center py-20 lg:py-28">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-xs font-black tracking-[0.24em] text-accent uppercase"><Zap className="size-4" aria-hidden />{config.heroEyebrow}</p>
              <h1 className="mt-6 max-w-3xl font-sans text-[2.75rem] leading-[0.88] font-black tracking-[-0.065em] text-balance uppercase sm:text-8xl lg:text-[6.6rem]">{config.heroHeadline}</h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-white/75">{config.heroSummary}</p>
              <div className="mt-9 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/cars">Explore stock <ArrowRight aria-hidden /></Link></Button><Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10"><Link href="/contact">Talk performance</Link></Button></div>
            </div>
          </div>
          <div className="relative min-h-[380px] lg:min-h-full">
            <Image src={config.heroImageUrl} alt={config.heroImageAlt} fill priority sizes="(max-width:1024px) 100vw, 55vw" className="object-cover lg:[clip-path:polygon(16%_0,100%_0,100%_100%,0_100%)]" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#111214] via-transparent to-transparent" />
          </div>
        </div>
        <div className="border-t border-white/15 bg-white/[0.04]"><div className="container-shell grid grid-cols-3 divide-x divide-white/15 py-5 text-center"><div><Gauge className="mx-auto size-5 text-accent" aria-hidden /><p className="mt-2 text-xs font-black uppercase">Key specs visible</p></div><div><ShieldCheck className="mx-auto size-5 text-accent" aria-hidden /><p className="mt-2 text-xs font-black uppercase">History made clear</p></div><div><Zap className="mx-auto size-5 text-accent" aria-hidden /><p className="mt-2 text-xs font-black uppercase">Fast direct enquiry</p></div></div></div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="container-shell">
          <div className="flex items-end justify-between gap-5 border-b-4 border-foreground pb-5"><div><p className="text-xs font-black tracking-[0.22em] text-brand uppercase">Ready now</p><h2 className="mt-2 text-5xl font-black tracking-[-0.06em] uppercase sm:text-6xl">Current machines</h2></div><Link href="/cars" className="hidden items-center gap-2 text-sm font-black uppercase sm:flex">All stock <ArrowRight className="size-4" aria-hidden /></Link></div>
          {featuredVehicles.length ? <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{featuredVehicles.map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} priority={index < 2} />)}</div> : <div className="mt-8"><InventoryEmptyState /></div>}
        </div>
      </section>

      <section className="theme-performance-slash bg-brand py-16 text-[var(--text-on-brand)] sm:py-20">
        <div className="container-shell flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black tracking-[0.22em] uppercase opacity-75">Can’t see the exact car?</p><h2 className="mt-3 max-w-4xl text-4xl font-black tracking-[-0.045em] uppercase sm:text-5xl">Give the team the brief. Make the search count.</h2></div><Button asChild size="lg" variant="outline" className="shrink-0 border-current text-current"><Link href="/source-a-car">Build a sourcing brief <ArrowRight aria-hidden /></Link></Button></div>
      </section>
    </div>
  );
}

export const themeHomeComponentRegistry = {
  "direct-motors-classic": ClassicHome,
  "modern-marketplace": MarketplaceHome,
  prestige: PrestigeHome,
  performance: PerformanceHome,
} as const satisfies Record<ThemeId, React.ComponentType<ThemeHomePageProps>>;

export function ThemeHomePage({
  themeId,
  ...props
}: ThemeHomePageProps & { themeId: ThemeId }) {
  const Component = themeHomeComponentRegistry[themeId];
  return <Component {...props} />;
}
