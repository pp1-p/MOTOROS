import { defaultPublicSiteName } from "@/lib/site-metadata";

export const publicSiteConfig = {
  name: process.env.NEXT_PUBLIC_DEALERSHIP_NAME ?? defaultPublicSiteName,
  strapline: "The friendly car people your family can trust.",
  heroEyebrow: "Family-run · Local · Honest",
  heroHeadline: "The right car for your family, without the hassle.",
  heroSummary:
    "Come and see the cars for yourself, take one out on a proper test drive, and ask us anything. Our workshop keeps you on the road long after you drive away.",
  primaryLabel: "See our cars",
  primaryHref: "/cars",
  heroImageUrl: "/images/hero-showroom.png",
  heroImageAlt: "Welcoming family-run dealership showroom",
  seoTitle: "Family car specialists, sourcing and trusted repairs",
  seoDescription:
    "A friendly family-run dealership. See our cars, ask us to source something specific, or book your car in with our trusted local workshop.",
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
