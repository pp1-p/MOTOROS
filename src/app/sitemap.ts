import type { MetadataRoute } from "next";

import { getPublicSiteConfig } from "@/lib/data/site-config";
import { getPublicVehicles } from "@/lib/data/vehicles";
import { isSiteIndexable } from "@/lib/site-metadata";
import { isWebsitePublished, resolvePublicBaseUrl } from "@/lib/themes";

const publicRoutes = [
  "",
  "/cars",
  "/about",
  "/find-us",
  "/part-exchange",
  "/finance",
  "/services",
  "/source-a-car",
  "/repairs",
  "/book-repair-call",
  "/contact",
  "/privacy",
  "/cookies",
  "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [siteConfig, vehicles] = await Promise.all([
    getPublicSiteConfig(),
    getPublicVehicles(),
  ]);
  if (!isSiteIndexable() || !isWebsitePublished(siteConfig)) return [];
  const baseUrl = resolvePublicBaseUrl(siteConfig);

  return [
    ...publicRoutes.map((route) => ({
      url: new URL(route || "/", baseUrl).toString(),
    })),
    ...vehicles.map((vehicle) => ({
      url: new URL(`/cars/${encodeURIComponent(vehicle.slug)}`, baseUrl).toString(),
      lastModified: new Date(vehicle.createdAt),
    })),
  ];
}
