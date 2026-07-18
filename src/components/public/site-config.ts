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
  phone: process.env.NEXT_PUBLIC_DEALERSHIP_PHONE?.trim() ?? "",
  phoneHref: process.env.NEXT_PUBLIC_DEALERSHIP_PHONE?.trim()
    ? `tel:${process.env.NEXT_PUBLIC_DEALERSHIP_PHONE.replace(/\s/g, "")}`
    : "/contact",
  email: process.env.NEXT_PUBLIC_DEALERSHIP_EMAIL?.trim() ?? "",
  address: process.env.NEXT_PUBLIC_DEALERSHIP_ADDRESS?.trim() ?? "",
  hours: [] as { days: string; times: string }[],
  logoUrl: null as string | null,
  primaryColour: "#172033",
  accentColour: "#D4A853",
};

export type PublicSiteConfig = typeof publicSiteConfig;
