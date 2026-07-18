import type { MetadataRoute } from "next";

import { isSiteIndexable } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  if (!isSiteIndexable()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const baseUrl = new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  );

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/auth/"],
    },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
  };
}
