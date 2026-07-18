import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

import {
  publicSiteConfig,
  type PublicSiteConfig,
} from "@/components/public/site-config";
import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/security/logger";

function environmentSiteConfig(): PublicSiteConfig {
  const phone = process.env.NEXT_PUBLIC_DEALERSHIP_PHONE?.trim() ?? "";
  return {
    ...publicSiteConfig,
    name:
      process.env.NEXT_PUBLIC_DEALERSHIP_NAME?.trim() ||
      "Independent dealership",
    phone,
    phoneHref: phone ? `tel:${phone.replace(/\s/g, "")}` : "/contact",
    email: process.env.NEXT_PUBLIC_DEALERSHIP_EMAIL?.trim() ?? "",
    address: process.env.NEXT_PUBLIC_DEALERSHIP_ADDRESS?.trim() ?? "",
    hours: [],
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
    const safeFallback = environmentSiteConfig();
    if (!isSupabaseConfigured()) {
      return isDevelopmentDemoMode() ? publicSiteConfig : safeFallback;
    }

    try {
      const env = getServerEnv();
      const supabase = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      let query = supabase
        .from("public_dealerships")
        .select("*")
        .limit(env.DEALEROS_PUBLIC_ORGANISATION_ID ? 1 : 2);
      if (env.DEALEROS_PUBLIC_ORGANISATION_ID) {
        query = query.eq("id", env.DEALEROS_PUBLIC_ORGANISATION_ID);
      }
      const result = await query;
      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) {
        throw new Error("No public dealership is configured.");
      }
      if (!env.DEALEROS_PUBLIC_ORGANISATION_ID && result.data.length > 1) {
        throw new Error(
          "Multiple public dealerships exist. Set DEALEROS_PUBLIC_ORGANISATION_ID.",
        );
      }
      const dealership = result.data[0];

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
