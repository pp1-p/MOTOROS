import type { CSSProperties } from "react";

export const THEME_IDS = [
  "direct-motors-classic",
  "modern-marketplace",
  "prestige",
  "performance",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  shortName: string;
  description: string;
  bestFor: string;
  fontPreset: "classic" | "modern" | "editorial" | "condensed";
  previewClassName: string;
  defaultColours: {
    background: string;
    foreground: string;
    surface: string;
    surfaceMuted: string;
    border: string;
    primary: string;
    accent: string;
  };
  layout: {
    header: "centred" | "utility" | "editorial" | "performance";
    home: "cinematic" | "marketplace" | "editorial" | "performance";
    inventory: "showroom" | "filter-first" | "gallery" | "spec-first";
    vehicle: "balanced" | "commerce" | "editorial" | "technical";
  };
};

export const themeDefinitions = [
  {
    id: "direct-motors-classic",
    name: "Direct Motors Classic",
    shortName: "Classic",
    description:
      "The established showroom experience: warm, reassuring and service-led.",
    bestFor: "Independent dealerships that want a trusted, traditional feel",
    fontPreset: "classic",
    previewClassName: "theme-preview-classic",
    defaultColours: {
      background: "#faf7f1",
      foreground: "#1b1c17",
      surface: "#ffffff",
      surfaceMuted: "#f2eee5",
      border: "#e4dfd3",
      primary: "#1b5c4f",
      accent: "#c38d39",
    },
    layout: {
      header: "centred",
      home: "cinematic",
      inventory: "showroom",
      vehicle: "balanced",
    },
  },
  {
    id: "modern-marketplace",
    name: "Modern Marketplace",
    shortName: "Marketplace",
    description:
      "Bright, spacious and search-led, with stock discovery always close at hand.",
    bestFor: "High-volume retailers focused on fast inventory browsing",
    fontPreset: "modern",
    previewClassName: "theme-preview-marketplace",
    defaultColours: {
      background: "#f3f6fb",
      foreground: "#10203b",
      surface: "#ffffff",
      surfaceMuted: "#e9eff8",
      border: "#d8e1ee",
      primary: "#155eef",
      accent: "#0e9384",
    },
    layout: {
      header: "utility",
      home: "marketplace",
      inventory: "filter-first",
      vehicle: "commerce",
    },
  },
  {
    id: "prestige",
    name: "Prestige",
    shortName: "Prestige",
    description:
      "A restrained, editorial design built around exceptional photography.",
    bestFor: "Luxury, executive and specialist vehicle collections",
    fontPreset: "editorial",
    previewClassName: "theme-preview-prestige",
    defaultColours: {
      background: "#0d0e10",
      foreground: "#f5f0e8",
      surface: "#17191d",
      surfaceMuted: "#22252b",
      border: "#34373d",
      primary: "#c8a66a",
      accent: "#ead9b7",
    },
    layout: {
      header: "editorial",
      home: "editorial",
      inventory: "gallery",
      vehicle: "editorial",
    },
  },
  {
    id: "performance",
    name: "Performance",
    shortName: "Performance",
    description:
      "Bold, technical and energetic, with decisive calls to action.",
    bestFor: "Sports, tuning and performance-focused dealerships",
    fontPreset: "condensed",
    previewClassName: "theme-preview-performance",
    defaultColours: {
      background: "#f3f3f1",
      foreground: "#111214",
      surface: "#ffffff",
      surfaceMuted: "#e7e8e6",
      border: "#d1d3d0",
      primary: "#d62f2f",
      accent: "#ffb000",
    },
    layout: {
      header: "performance",
      home: "performance",
      inventory: "spec-first",
      vehicle: "technical",
    },
  },
] as const satisfies readonly ThemeDefinition[];

export const listThemeDefinitions = () => themeDefinitions;

export const themeRegistry: Readonly<Record<ThemeId, ThemeDefinition>> =
  Object.freeze(
    Object.fromEntries(themeDefinitions.map((theme) => [theme.id, theme])) as Record<
      ThemeId,
      ThemeDefinition
    >,
  );

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function getThemeDefinition(value: unknown): ThemeDefinition {
  return themeRegistry[isThemeId(value) ? value : "direct-motors-classic"];
}

function optionalField(config: unknown, key: string): unknown {
  return config && typeof config === "object"
    ? (config as Record<string, unknown>)[key]
    : undefined;
}

export function resolvePublishedThemeId(config: unknown): ThemeId {
  return isThemeId(optionalField(config, "publishedThemeId"))
    ? (optionalField(config, "publishedThemeId") as ThemeId)
    : "direct-motors-classic";
}

export function resolveDraftThemeId(config: unknown): ThemeId {
  const draft = optionalField(config, "draftThemeId");
  return isThemeId(draft) ? draft : resolvePublishedThemeId(config);
}

export function isDirectMotorsSite(config: unknown) {
  const slug =
    optionalField(config, "organisationSlug") ?? optionalField(config, "slug");
  const name = optionalField(config, "name");
  return (
    (typeof slug === "string" && slug.toLowerCase() === "direct-motors") ||
    (typeof name === "string" && /\bdirect motors\b/i.test(name))
  );
}

export function resolvePublicBaseUrl(config: unknown) {
  const configured = optionalField(config, "baseUrl");
  if (typeof configured === "string") {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.hostname === "localhost") {
        return url;
      }
    } catch {
      // Fall back to the deployment URL below.
    }
  }
  return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

export function isWebsitePublished(config: unknown) {
  const status = optionalField(config, "websiteStatus");
  return status === undefined || status === null || status === "published";
}

function normaliseHex(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback;
}

function rgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function hex({ r, g, b }: { r: number; g: number; b: number }) {
  const channel = (value: number) =>
    Math.round(Math.max(0, Math.min(255, value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function mix(colour: string, target: string, amount: number) {
  const a = rgb(colour);
  const b = rgb(target);
  return hex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

function luminance(colour: string) {
  const value = rgb(colour);
  const channel = (entry: number) => {
    const normalised = entry / 255;
    return normalised <= 0.04045
      ? normalised / 12.92
      : ((normalised + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(value.r) + 0.7152 * channel(value.g) + 0.0722 * channel(value.b);
}

export function contrastRatio(first: string, second: string) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  const light = Math.max(firstLuminance, secondLuminance);
  const dark = Math.min(firstLuminance, secondLuminance);
  return (light + 0.05) / (dark + 0.05);
}

export function getThemeStyle(
  themeId: ThemeId,
  config: { primaryColour?: unknown; accentColour?: unknown } | unknown,
): CSSProperties {
  const theme = getThemeDefinition(themeId);
  const record = config && typeof config === "object" ? (config as Record<string, unknown>) : {};
  const requestedPrimary = normaliseHex(
    record.primaryColour,
    theme.defaultColours.primary,
  );
  const primary =
    contrastRatio(requestedPrimary, theme.defaultColours.background) >= 3
      ? requestedPrimary
      : theme.defaultColours.primary;
  const accent = normaliseHex(record.accentColour, theme.defaultColours.accent);
  const darkTheme = contrastRatio(theme.defaultColours.background, "#000000") < 3;
  const primaryStrong = mix(primary, darkTheme ? "#ffffff" : "#000000", 0.2);
  const primarySoft = mix(primary, theme.defaultColours.background, 0.84);
  const textOnPrimary =
    contrastRatio(primary, "#ffffff") >= contrastRatio(primary, "#101214")
      ? "#ffffff"
      : "#101214";

  return {
    "--background": theme.defaultColours.background,
    "--foreground": theme.defaultColours.foreground,
    "--surface": theme.defaultColours.surface,
    "--surface-muted": theme.defaultColours.surfaceMuted,
    "--border": theme.defaultColours.border,
    "--brand": primary,
    "--brand-strong": primaryStrong,
    "--brand-soft": primarySoft,
    "--accent": accent,
    "--text-on-brand": textOnPrimary,
  } as CSSProperties;
}
