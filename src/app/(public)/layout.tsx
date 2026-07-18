import type { ReactNode } from "react";

import { CookiePreferences } from "@/components/public/cookie-preferences";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getPublicSiteConfig } from "@/lib/data/site-config";

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
