export const websiteThemeIds = [
  "modern",
  "performance",
  "classic",
  "luxury",
] as const;

export type WebsiteThemeId = (typeof websiteThemeIds)[number];

export type WebsiteThemeDefinition = {
  id: WebsiteThemeId;
  name: string;
  strapline: string;
  description: string;
  surface: string;
  ink: string;
  accent: string;
  requiredEntitlement: string | null;
};

export const websiteThemes: readonly WebsiteThemeDefinition[] = [
  {
    id: "modern",
    name: "Modern",
    strapline: "Clean and conversion-focused",
    description: "Bright surfaces, crisp vehicle cards and confident calls to action.",
    surface: "#ffffff",
    ink: "#172033",
    accent: "#2f6f60",
    requiredEntitlement: null,
  },
  {
    id: "performance",
    name: "Performance",
    strapline: "Dark and high-impact",
    description: "Strong contrast and cinematic stock presentation for performance dealers.",
    surface: "#111315",
    ink: "#f7f7f5",
    accent: "#ef3d32",
    requiredEntitlement: "website.themes.premium",
  },
  {
    id: "classic",
    name: "Classic Dealer",
    strapline: "Familiar and trustworthy",
    description: "Traditional dealership styling with clear navigation and contact actions.",
    surface: "#f6f1e7",
    ink: "#22354a",
    accent: "#b87a2c",
    requiredEntitlement: null,
  },
  {
    id: "luxury",
    name: "Luxury",
    strapline: "Restrained and editorial",
    description: "Generous whitespace and premium typography for prestige stock.",
    surface: "#f7f5f0",
    ink: "#161616",
    accent: "#9c7b45",
    requiredEntitlement: "website.themes.premium",
  },
] as const;

export function isWebsiteThemeId(value: string): value is WebsiteThemeId {
  return websiteThemeIds.includes(value as WebsiteThemeId);
}

export function getWebsiteTheme(
  value: string | null | undefined,
): WebsiteThemeDefinition {
  return websiteThemes.find((theme) => theme.id === value) ?? websiteThemes[0]!;
}

export function selectWebsiteTheme<T>(content: T, themeId: WebsiteThemeId) {
  return { content, themeId };
}
