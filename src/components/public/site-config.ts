import { defaultPublicSiteName } from "@/lib/site-metadata";

export const publicSiteConfig = {
  name: process.env.NEXT_PUBLIC_DEALERSHIP_NAME ?? defaultPublicSiteName,
  strapline: "Independent motoring, properly handled.",
  heroEyebrow: "Independent motor specialists",
  heroHeadline: "The right car. Properly handled.",
  heroSummary:
    "Thoughtfully selected used cars, considered sourcing and trusted workshop support—brought together by one independent team.",
  primaryLabel: "Explore cars for sale",
  primaryHref: "/cars",
  heroImageUrl: "/images/hero-showroom.png",
  heroImageAlt: "Premium independent car showroom at dusk",
  seoTitle: "Quality used cars, sourcing and repairs",
  seoDescription:
    "Explore carefully selected used cars, ask us to source something specific, or book a repair discussion with an independent UK dealership.",
  phone: process.env.NEXT_PUBLIC_DEALERSHIP_PHONE ?? "01632 960 482",
  phoneHref: `tel:${(
    process.env.NEXT_PUBLIC_DEALERSHIP_PHONE ?? "01632 960 482"
  ).replace(/\s/g, "")}`,
  email:
    process.env.NEXT_PUBLIC_DEALERSHIP_EMAIL ?? "hello@dealeros.example",
  address:
    process.env.NEXT_PUBLIC_DEALERSHIP_ADDRESS ??
    "Independent dealership · United Kingdom",
  hours: [
    { days: "Monday – Friday", times: "08:30 – 18:00" },
    { days: "Saturday", times: "09:00 – 17:00" },
    { days: "Sunday", times: "By appointment" },
  ],
  logoUrl: null as string | null,
  primaryColour: "#172033",
  accentColour: "#D4A853",
};

export type PublicSiteConfig = typeof publicSiteConfig;
