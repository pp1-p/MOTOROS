import type { MetadataRoute } from "next";

import { getPublicVehicles } from "@/lib/data/vehicles";
import { isSiteIndexable } from "@/lib/site-metadata";

const publicRoutes = [
  "",
  "/cars",
  "/source-a-car",
  "/repairs",
  "/book-repair-call",
  "/contact",
  "/privacy",
  "/cookies",
  "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isSiteIndexable()) return [];

  const baseUrl = new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  );
  const vehicles = await getPublicVehicles();

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
