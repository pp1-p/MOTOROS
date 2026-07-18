import type { Metadata } from "next";
import {
  BadgeCheck,
  CalendarDays,
  CarFront,
  Check,
  CircleGauge,
  Fuel,
  Gauge,
  KeyRound,
  Milestone,
  Paintbrush,
  Phone,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { VehicleEnquiryForm } from "@/components/forms/vehicle-enquiry-form";
import { SectionHeading } from "@/components/public/section-heading";
import { ShareButton } from "@/components/public/share-button";
import { VehicleCard } from "@/components/public/vehicle-card";
import { VehicleGallery } from "@/components/public/vehicle-gallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getPublicVehicleBySlug,
  getPublicVehicles,
  getRelatedVehicles,
  getVehiclePresentation,
} from "@/lib/data/vehicles";
import { getPublicSiteConfig } from "@/lib/data/site-config";
import { formatCurrency, formatMileage } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const enquiryTypes = [
  "vehicle_enquiry",
  "test_drive",
  "callback_request",
  "part_exchange",
] as const;

type EnquiryType = (typeof enquiryTypes)[number];

export async function generateStaticParams() {
  const vehicles = await getPublicVehicles();
  return vehicles.map((vehicle) => ({ slug: vehicle.slug }));
}

export async function generateMetadata({
  params,
}: Pick<PageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getPublicVehicleBySlug(slug);
  if (!vehicle) return { title: "Vehicle not found" };

  const description = `${vehicle.registrationYear} ${vehicle.publicTitle}, ${formatMileage(
    vehicle.mileage,
  )}, ${vehicle.fuelType}, ${vehicle.transmission}. ${vehicle.attentionGrabber ?? ""}`;

  return {
    title: `${vehicle.publicTitle} for sale`,
    description,
    openGraph: {
      title: `${vehicle.publicTitle} | ${formatCurrency(vehicle.price)}`,
      description,
      images: vehicle.imageUrl
        ? [{ url: vehicle.imageUrl, alt: vehicle.imageAlt ?? vehicle.publicTitle }]
        : undefined,
    },
  };
}

export default async function VehicleDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const publicSiteConfig = await getPublicSiteConfig();
  const vehicle = await getPublicVehicleBySlug(slug);
  if (!vehicle) notFound();

  const relatedVehicles = await getRelatedVehicles(vehicle);
  const presentation = getVehiclePresentation(vehicle);
  const requestedEnquiry = Array.isArray(query.enquiry)
    ? query.enquiry[0]
    : query.enquiry;
  const defaultEnquiryType = enquiryTypes.includes(
    requestedEnquiry as EnquiryType,
  )
    ? (requestedEnquiry as EnquiryType)
    : "vehicle_enquiry";

  const availability =
    vehicle.status === "sold"
      ? "https://schema.org/OutOfStock"
      : vehicle.status === "reserved"
        ? "https://schema.org/LimitedAvailability"
        : vehicle.status === "preparation"
          ? "https://schema.org/PreOrder"
          : "https://schema.org/InStock";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: vehicle.publicTitle,
    description: vehicle.description,
    image: vehicle.images.map((item) => item.url),
    sku: vehicle.stockNumber,
    brand: { "@type": "Brand", name: vehicle.make },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: vehicle.mileage,
      unitCode: "SMI",
    },
    fuelType: vehicle.fuelType,
    vehicleTransmission: vehicle.transmission,
    color: vehicle.colour,
    vehicleEngine: vehicle.engineSizeCc
      ? {
          "@type": "EngineSpecification",
          engineDisplacement: {
            "@type": "QuantitativeValue",
            value: vehicle.engineSizeCc,
            unitCode: "CMQ",
          },
        }
      : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "GBP",
      price: vehicle.price,
      availability,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/cars/${vehicle.slug}`,
      itemCondition: "https://schema.org/UsedCondition",
    },
  };

  const primarySpecs = [
    { icon: CalendarDays, label: "Registration", value: vehicle.registrationYear },
    { icon: Milestone, label: "Mileage", value: formatMileage(vehicle.mileage) },
    { icon: Fuel, label: "Fuel", value: vehicle.fuelType },
    { icon: Gauge, label: "Transmission", value: vehicle.transmission },
    {
      icon: Settings2,
      label: "Engine",
      value: vehicle.engineSizeCc
        ? `${(vehicle.engineSizeCc / 1000).toFixed(1)} litre`
        : "Ask the team",
    },
    { icon: Paintbrush, label: "Colour", value: vehicle.colour ?? "Ask the team" },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <section className="border-b bg-white">
        <div className="container-shell py-4">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground/50"
          >
            <Link className="hover:text-brand" href="/">
              Home
            </Link>
            <span aria-hidden>/</span>
            <Link className="hover:text-brand" href="/cars">
              Cars for sale
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground/80">{vehicle.publicTitle}</span>
          </nav>
        </div>
      </section>

      <section className="py-7 sm:py-10">
        <div className="container-shell">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant={presentation.tone}>{presentation.label}</Badge>
                <span className="text-xs font-bold tracking-[0.1em] text-foreground/45 uppercase">
                  Stock {vehicle.stockNumber}
                </span>
              </div>
              <h1 className="max-w-4xl font-display text-5xl leading-[0.96] tracking-tight text-balance sm:text-6xl">
                {vehicle.publicTitle}
              </h1>
              <p className="mt-4 text-sm font-semibold text-foreground/60 sm:text-base">
                {vehicle.attentionGrabber}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 lg:block lg:text-right">
              <p className="text-xs font-extrabold tracking-[0.12em] text-brand uppercase">
                Retail price
              </p>
              <p className="mt-1 text-3xl font-extrabold sm:text-4xl">
                {formatCurrency(vehicle.price)}
              </p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="min-w-0">
              <VehicleGallery images={vehicle.images} title={vehicle.publicTitle} />
            </div>

            <aside className="lg:sticky lg:top-5 lg:self-start">
              <div className="rounded-3xl border bg-white p-6 shadow-[0_20px_55px_rgba(15,24,18,0.09)]">
                <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                  {primarySpecs.slice(0, 4).map((spec) => (
                    <div key={spec.label} className="border-b pb-4">
                      <span className="flex items-center gap-2 text-xs font-bold text-foreground/45">
                        <spec.icon className="size-3.5 text-brand" aria-hidden />
                        {spec.label}
                      </span>
                      <span className="mt-1 block text-sm font-extrabold">
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>

                {vehicle.status === "sold" ? (
                  <div className="mt-6 rounded-2xl bg-surface-muted p-5 text-sm leading-6">
                    This car has found its next owner. We can search for
                    something similar through our sourcing service.
                  </div>
                ) : vehicle.status === "reserved" ? (
                  <div className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                    This vehicle is currently reserved. Enquire to join the
                    priority list if it becomes available.
                  </div>
                ) : vehicle.status === "preparation" ? (
                  <div className="mt-6 rounded-2xl bg-blue-50 p-5 text-sm leading-6 text-blue-900">
                    This car is moving through inspection and preparation.
                    Register your interest for the earliest viewing opportunity.
                  </div>
                ) : null}

                <div className="mt-6 grid gap-3">
                  <Button asChild size="lg">
                    <Link href="?enquiry=test_drive#enquire">
                      <CalendarDays aria-hidden />
                      {vehicle.status === "sold"
                        ? "Ask us to find similar"
                        : "Arrange a viewing"}
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="?enquiry=callback_request#enquire">
                      <Phone aria-hidden />
                      Request a callback
                    </Link>
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button asChild variant="ghost">
                      <Link href="?enquiry=part_exchange#enquire">
                        Part exchange
                      </Link>
                    </Button>
                    <ShareButton title={vehicle.publicTitle} />
                  </div>
                </div>
                <p className="mt-5 text-center text-xs leading-5 text-foreground/45">
                  Prefer to call?{" "}
                  <a
                    className="font-bold text-brand"
                    href={publicSiteConfig.phoneHref}
                  >
                    {publicSiteConfig.phone}
                  </a>
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-y bg-white py-12 sm:py-16">
        <div className="container-shell">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
            {primarySpecs.map((spec) => (
              <div key={spec.label} className="rounded-2xl bg-background p-5">
                <spec.icon className="size-5 text-brand" aria-hidden />
                <dt className="mt-4 text-xs font-bold text-foreground/45">
                  {spec.label}
                </dt>
                <dd className="mt-1 text-sm font-extrabold">{spec.value}</dd>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="container-shell grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div>
            <p className="text-xs font-extrabold tracking-[0.18em] text-brand uppercase">
              About this car
            </p>
            <h2 className="mt-4 font-display text-5xl leading-none tracking-tight">
              A closer look
            </h2>
            <p className="mt-6 text-base leading-8 text-foreground/68">
              {vehicle.description}
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Wrench,
                  label: "Service history",
                  value: vehicle.serviceHistory ?? "Ask the team",
                },
                {
                  icon: ShieldCheck,
                  label: "Warranty",
                  value: vehicle.warranty ?? "Ask the team",
                },
                {
                  icon: CalendarDays,
                  label: "MOT",
                  value: vehicle.motExpiry
                    ? `Valid until ${new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(vehicle.motExpiry))}`
                    : "Ask the team",
                },
                {
                  icon: BadgeCheck,
                  label: "ULEZ",
                  value: vehicle.ulezCompliant
                    ? "Compliant based on recorded data"
                    : "Please verify before travel",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border bg-white p-5">
                  <item.icon className="size-5 text-brand" aria-hidden />
                  <p className="mt-4 text-xs font-bold text-foreground/45">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-extrabold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-extrabold tracking-[0.18em] text-brand uppercase">
              Notable equipment
            </p>
            <h2 className="mt-4 font-display text-5xl leading-none tracking-tight">
              The useful details
            </h2>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {vehicle.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 rounded-xl bg-brand-soft/60 p-4 text-sm font-bold text-brand-strong"
                >
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>

            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
              {[
                { icon: CarFront, label: "Doors", value: vehicle.doors },
                { icon: Users, label: "Seats", value: vehicle.seats },
                { icon: KeyRound, label: "Keys", value: vehicle.keys },
                {
                  icon: CircleGauge,
                  label: "Owners",
                  value: vehicle.previousOwners,
                },
                {
                  icon: Sparkles,
                  label: "Body",
                  value: vehicle.bodyType ?? "—",
                },
                {
                  icon: Settings2,
                  label: "Gearbox",
                  value: vehicle.transmission,
                },
              ].map((item) => (
                <div key={item.label} className="bg-white p-4">
                  <item.icon className="size-4 text-brand" aria-hidden />
                  <dt className="mt-3 text-xs text-foreground/45">{item.label}</dt>
                  <dd className="mt-1 text-sm font-extrabold">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section id="enquire" className="scroll-mt-5 bg-[#15221d] py-16 text-white sm:py-24">
        <div className="container-shell grid gap-12 lg:grid-cols-[0.8fr_1.1fr] lg:gap-20">
          <div>
            <p className="text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
              Speak to the team
            </p>
            <h2 className="mt-4 font-display text-5xl leading-[0.96] tracking-tight text-balance sm:text-6xl">
              Let’s make the next step useful.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-8 text-white/65">
              Ask a question, arrange a viewing or tell us about a part
              exchange. The enquiry goes directly into our team’s follow-up
              queue.
            </p>
            <ul className="mt-8 grid gap-4 text-sm font-bold text-white/75">
              {[
                "A direct response from the dealership team",
                "No obligation and no automated sales sequence",
                "Your preferred contact method respected",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="grid size-7 place-items-center rounded-full bg-[#d7ad69]/15 text-[#d7ad69]">
                    <Check className="size-4" aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant="outline"
              className="mt-9 border-white/25 text-white hover:bg-white/10"
            >
              <Link href={`/source-a-car?similar=${vehicle.slug}`}>
                Source something similar
              </Link>
            </Button>
          </div>
          <div className="rounded-3xl bg-white p-6 text-foreground shadow-2xl sm:p-8">
            <VehicleEnquiryForm
              vehicleId={vehicle.id}
              vehicleTitle={vehicle.publicTitle}
              defaultType={defaultEnquiryType}
            />
          </div>
        </div>
      </section>

      {relatedVehicles.length ? (
        <section className="py-16 sm:py-24">
          <div className="container-shell">
            <SectionHeading
              eyebrow="Keep exploring"
              title="You may also like"
              action={
                <Button asChild variant="outline">
                  <Link href="/cars">View all cars</Link>
                </Button>
              }
            />
            <div className="mt-9 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {relatedVehicles.map((related) => (
                <VehicleCard key={related.id} vehicle={related} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t bg-white py-8">
        <div className="container-shell">
          <p className="text-xs leading-6 text-foreground/48">
            Vehicle information can include data supplied by manufacturers and
            third parties. While we take care to check the advert, errors can
            occur. Please verify any specification, equipment, mileage,
            emissions status and other detail that is important to your
            purchase before committing. Images are illustrative of the listed
            vehicle presentation and should be checked against the vehicle at
            viewing.
          </p>
        </div>
      </section>
    </>
  );
}
