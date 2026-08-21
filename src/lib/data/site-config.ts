import "server-only";

import { cache } from "react";

import {
  publicSiteConfig,
  type PublicSiteConfig,
} from "@/components/public/site-config";
import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/security/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPublicTenant } from "@/lib/tenancy/public-tenant";

function environmentSiteConfig(
  tenant?: Awaited<ReturnType<typeof getPublicTenant>>,
): PublicSiteConfig {
  const mayUseLegacyContactFallback =
    !tenant ||
    (Boolean(process.env.DEALEROS_PUBLIC_ORGANISATION_ID) &&
      tenant.organisationId === process.env.DEALEROS_PUBLIC_ORGANISATION_ID);
  return {
    ...publicSiteConfig,
    organisationId: tenant?.organisationId ?? publicSiteConfig.organisationId,
    organisationSlug:
      tenant?.slug ?? publicSiteConfig.organisationSlug,
    hostname: tenant?.hostname ?? publicSiteConfig.hostname,
    baseUrl: tenant?.baseUrl ?? publicSiteConfig.baseUrl,
    websiteStatus: tenant?.websiteStatus ?? publicSiteConfig.websiteStatus,
    name:
      tenant?.name ??
      process.env.NEXT_PUBLIC_DEALERSHIP_NAME?.trim() ??
      "Independent dealership",
    phone: mayUseLegacyContactFallback ? publicSiteConfig.phone : "",
    phoneHref: mayUseLegacyContactFallback
      ? publicSiteConfig.phoneHref
      : "/contact",
    phones: mayUseLegacyContactFallback ? publicSiteConfig.phones : [],
    email: mayUseLegacyContactFallback
      ? process.env.NEXT_PUBLIC_DEALERSHIP_EMAIL?.trim() ?? ""
      : "",
    address: mayUseLegacyContactFallback
      ? process.env.NEXT_PUBLIC_DEALERSHIP_ADDRESS?.trim() ?? ""
      : "",
  };
}

function configuredString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function safeInternalHref(value: unknown, fallback: string) {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(value)
  ) {
    try {
      const origin = "https://dealeros.invalid";
      const parsed = new URL(value, origin);
      if (parsed.origin === origin) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      // Fall through to the known-safe internal destination.
    }
  }
  return fallback;
}

function safeImageUrl(value: unknown, fallback: string) {
  if (
    typeof value === "string" &&
    ((value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\") &&
      !/[\u0000-\u001f\u007f]/.test(value)) ||
      value.startsWith("https://"))
  ) {
    return value;
  }
  return fallback;
}

function formatAddress(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  if (typeof record.formatted === "string") return record.formatted;
  const formatted = ["line1", "line2", "town", "county", "postcode", "country"]
    .map((key) => record[key])
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .join(", ");
  return formatted || fallback;
}

function formatHours(
  value: unknown,
  fallback: PublicSiteConfig["hours"],
): PublicSiteConfig["hours"] {
  if (!value || typeof value !== "object") return fallback;
  const labels: Record<string, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };
  const rows = Object.entries(value as Record<string, unknown>).map(
    ([day, schedule]) => {
      if (!schedule || typeof schedule !== "object") {
        return { days: labels[day] ?? day, times: "Closed" };
      }
      const item = schedule as Record<string, unknown>;
      return {
        days: labels[day] ?? day,
        times:
          typeof item.open === "string" && typeof item.close === "string"
            ? `${item.open} – ${item.close}`
            : "Closed",
      };
    },
  );
  return rows.length > 0 ? rows : fallback;
}

export const getPublicSiteConfig = cache(
  async (): Promise<PublicSiteConfig> => {
    if (!isSupabaseConfigured()) {
      return isDevelopmentDemoMode()
        ? publicSiteConfig
        : environmentSiteConfig();
    }

    // Resolve outside the fallback block. An unknown production hostname must
    // not silently inherit the branding or data of another dealership.
    const tenant = await getPublicTenant();
    const safeFallback = environmentSiteConfig(tenant);

    try {
      const supabase = createAdminSupabaseClient();
      const result = await supabase
        .from("dealership_settings")
        .select(
          "organisation_id,dealership_name,logo_path,telephone,email,address,opening_hours,brand_primary_colour,brand_accent_colour,homepage_wording,published_theme_id,font_preset,theme_settings",
        )
        .eq("organisation_id", tenant.organisationId)
        .limit(1)
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        throw new Error("No public dealership is configured.");
      }
      const dealership = result.data;

      const phone = configuredString(
        dealership.telephone,
        safeFallback.phone,
      );
      const wording =
        dealership.homepage_wording &&
        typeof dealership.homepage_wording === "object"
          ? (dealership.homepage_wording as Record<string, unknown>)
          : {};
      const logoUrl = dealership.logo_path
        ? supabase.storage
            .from("branding-public")
            .getPublicUrl(dealership.logo_path).data.publicUrl
        : null;

      return {
        organisationId: tenant.organisationId,
        organisationSlug: tenant.slug,
        hostname: tenant.hostname,
        baseUrl: tenant.baseUrl,
        websiteStatus: tenant.websiteStatus,
        publishedThemeId: configuredString(
          dealership.published_theme_id,
          safeFallback.publishedThemeId,
        ),
        // Public requests never receive an unpublished theme selection.
        draftThemeId: configuredString(
          dealership.published_theme_id,
          safeFallback.publishedThemeId,
        ),
        fontPreset: configuredString(
          dealership.font_preset,
          safeFallback.fontPreset,
        ),
        themeSettings:
          dealership.theme_settings &&
          typeof dealership.theme_settings === "object" &&
          !Array.isArray(dealership.theme_settings)
            ? (dealership.theme_settings as Record<string, unknown>)
            : safeFallback.themeSettings,
        name: configuredString(dealership.dealership_name, safeFallback.name),
        strapline:
          configuredString(
            wording.eyebrow,
            configuredString(wording.headline, safeFallback.strapline),
          ),
        heroEyebrow: configuredString(
          wording.eyebrow,
          safeFallback.heroEyebrow,
        ),
        heroHeadline: configuredString(
          wording.headline,
          configuredString(wording.title, safeFallback.heroHeadline),
        ),
        heroSummary: configuredString(
          wording.summary,
          configuredString(wording.body, safeFallback.heroSummary),
        ),
        primaryLabel: configuredString(
          wording.primaryLabel,
          safeFallback.primaryLabel,
        ),
        primaryHref: safeInternalHref(
          wording.primaryHref,
          safeFallback.primaryHref,
        ),
        heroImageUrl: safeImageUrl(
          wording.heroImageUrl ?? wording.imageUrl,
          safeFallback.heroImageUrl,
        ),
        heroImageAlt: configuredString(
          wording.imageAlt ?? wording.heroImageAlt,
          safeFallback.heroImageAlt,
        ),
        seoTitle: configuredString(
          wording.seoTitle,
          safeFallback.seoTitle,
        ),
        seoDescription: configuredString(
          wording.seoDescription,
          safeFallback.seoDescription,
        ),
        phone,
        phoneHref: phone
          ? `tel:${String(phone).replace(/\s/g, "")}`
          : safeFallback.phoneHref,
        phones:
          phone && phone !== safeFallback.phone
            ? [phone, ...safeFallback.phones.filter((entry) => entry !== phone)]
            : safeFallback.phones,
        email: configuredString(dealership.email, safeFallback.email),
        address: formatAddress(dealership.address, safeFallback.address),
        hours: formatHours(dealership.opening_hours, safeFallback.hours),
        logoUrl,
        primaryColour:
          dealership.brand_primary_colour ?? safeFallback.primaryColour,
        accentColour:
          dealership.brand_accent_colour ?? safeFallback.accentColour,
      };
    } catch (error) {
      log("error", "public_site_config.query_failed", {
        message:
          error instanceof Error
            ? error.message
            : "Unknown public settings query failure",
      });
      return isDevelopmentDemoMode() ? publicSiteConfig : safeFallback;
    }
  },
);
