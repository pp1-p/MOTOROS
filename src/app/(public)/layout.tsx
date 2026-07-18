import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CookiePreferences } from "@/components/public/cookie-preferences";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getPublicSiteConfig } from "@/lib/data/site-config";
import {
  buildPublicSeoTitle,
  isSiteIndexable,
} from "@/lib/site-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getPublicSiteConfig();
  const title = buildPublicSeoTitle(siteConfig.seoTitle, siteConfig.name);
  const siteIndexable = isSiteIndexable();

  return {
    title: {
      default: title,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.seoDescription,
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName: siteConfig.name,
      title,
      description: siteConfig.seoDescription,
    },
    robots: {
      index: siteIndexable,
      follow: siteIndexable,
    },
  };
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const siteConfig = await getPublicSiteConfig();
  return (
    <div
      className="min-h-screen bg-background"
      style={
        {
          "--brand": siteConfig.primaryColour,
          "--accent": siteConfig.accentColour,
        } as React.CSSProperties
      }
    >
      <PublicHeader config={siteConfig} />
      <main id="main-content">{children}</main>
      <PublicFooter config={siteConfig} />
      <CookiePreferences />
    </div>
  );
}
