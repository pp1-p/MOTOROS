import type { MetadataRoute } from "next";

import { getPublicSiteConfig } from "@/lib/data/site-config";
import { isSiteIndexable } from "@/lib/site-metadata";
import { isWebsitePublished, resolvePublicBaseUrl } from "@/lib/themes";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteConfig = await getPublicSiteConfig();
  if (!isSiteIndexable() || !isWebsitePublished(siteConfig)) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const baseUrl = resolvePublicBaseUrl(siteConfig);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/auth/", "/platform/"],
    },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
  };
}
