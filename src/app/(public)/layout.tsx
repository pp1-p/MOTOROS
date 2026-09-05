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
import {
  getThemeStyle,
  isWebsitePublished,
  resolvePublicBaseUrl,
  resolvePublishedThemeId,
} from "@/lib/themes";

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getPublicSiteConfig();
  const title = buildPublicSeoTitle(siteConfig.seoTitle, siteConfig.name);
  const siteIndexable = isSiteIndexable() && isWebsitePublished(siteConfig);
  const baseUrl = resolvePublicBaseUrl(siteConfig);

  return {
    metadataBase: baseUrl,
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
      url: baseUrl,
    },
    robots: {
      index: siteIndexable,
      follow: siteIndexable,
    },
  };
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const siteConfig = await getPublicSiteConfig();
  const themeId = resolvePublishedThemeId(siteConfig);
  const style = getThemeStyle(themeId, siteConfig);

  if (!isWebsitePublished(siteConfig)) {
    return (
      <div
        data-public-theme={themeId}
        className="theme-root min-h-screen bg-background text-foreground"
        style={style}
      >
        <main id="main-content" className="container-shell grid min-h-screen place-items-center py-20 text-center">
          <div className="max-w-xl rounded-3xl border bg-surface p-8 surface-shadow sm:p-12">
            <p className="text-xs font-extrabold tracking-[0.16em] text-brand uppercase">
              Website being prepared
            </p>
            <h1 className="mt-4 font-display text-4xl text-balance sm:text-5xl">
              {siteConfig.name} will be online soon.
            </h1>
            <p className="mt-5 leading-7 text-foreground/75">
              The dealership is reviewing its website before publication. Please check back shortly.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      data-public-theme={themeId}
      className="theme-root min-h-screen bg-background text-foreground"
      style={style}
    >
      <PublicHeader config={siteConfig} />
      <main id="main-content">{children}</main>
      <PublicFooter config={siteConfig} />
      <CookiePreferences />
    </div>
  );
}
