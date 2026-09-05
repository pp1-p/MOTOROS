import { defaultPublicSiteName } from "@/lib/site-metadata";

function parsePhonesFromEnv(): string[] {
  const listed = process.env.NEXT_PUBLIC_DEALERSHIP_PHONES?.trim();
  if (listed) {
    return listed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  const single = process.env.NEXT_PUBLIC_DEALERSHIP_PHONE?.trim();
  // Tenant contact details belong in dealership_settings. An empty fallback is
  // safer than ever showing one dealership's phone number on another site.
  return single ? [single] : [];
}

const configuredPhones = parsePhonesFromEnv();
const primaryPhone = configuredPhones[0] ?? "";

export type PublicSiteConfig = {
  organisationId: string;
  organisationSlug: string;
  hostname: string;
  baseUrl: string;
  websiteStatus: "draft" | "published" | "unpublished";
  publishedThemeId: string;
  draftThemeId: string;
  fontPreset: string;
  themeSettings: Record<string, unknown>;
  name: string;
  strapline: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroSummary: string;
  primaryLabel: string;
  primaryHref: string;
  heroImageUrl: string;
  heroImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  phone: string;
  phoneHref: string;
  phones: string[];
  email: string;
  address: string;
  hours: Array<{ days: string; times: string }>;
  logoUrl: string | null;
  primaryColour: string;
  accentColour: string;
};

export const publicSiteConfig: PublicSiteConfig = {
  organisationId:
    process.env.DEALEROS_PUBLIC_ORGANISATION_ID ??
    "00000000-0000-4000-8000-000000000001",
  organisationSlug: "direct-motors",
  hostname: "localhost",
  baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  websiteStatus: "published",
  publishedThemeId: "direct-motors-classic",
  draftThemeId: "direct-motors-classic",
  fontPreset: "classic",
  themeSettings: {},
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
  phone: primaryPhone,
  phoneHref: primaryPhone
    ? `tel:${primaryPhone.replace(/\s/g, "")}`
    : "/contact",
  phones: configuredPhones,
  email: process.env.NEXT_PUBLIC_DEALERSHIP_EMAIL?.trim() ?? "",
  address: process.env.NEXT_PUBLIC_DEALERSHIP_ADDRESS?.trim() ?? "",
  hours: [
    { days: "Monday", times: "09:00 – 18:00" },
    { days: "Tuesday", times: "09:00 – 18:00" },
    { days: "Wednesday", times: "09:00 – 18:00" },
    { days: "Thursday", times: "09:00 – 18:00" },
    { days: "Friday", times: "09:00 – 18:00" },
    { days: "Saturday", times: "10:00 – 16:00" },
    { days: "Sunday", times: "By appointment" },
  ] as { days: string; times: string }[],
  logoUrl: null as string | null,
  primaryColour: "#172033",
  accentColour: "#D4A853",
};
