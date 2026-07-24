import { defaultPublicSiteName } from "@/lib/site-metadata";

export const publicSiteConfig = {
  name: process.env.NEXT_PUBLIC_DEALERSHIP_NAME ?? defaultPublicSiteName,
  strapline: "Quality cars, honest advice, trusted workshop.",
  heroEyebrow: "Independent · Local · Straightforward",
  heroHeadline: "The right car, without the runaround.",
  heroSummary:
    "Quality used cars, honest advice on what suits you, and a workshop that looks after you long after you drive away.",
  primaryLabel: "See our cars",
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
