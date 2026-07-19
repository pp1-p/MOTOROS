import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import {
  defaultPublicSiteName,
  isSiteIndexable,
} from "@/lib/site-metadata";

import "./globals.css";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-web",
  axes: ["opsz"],
});

const sansFont = Manrope({
  subsets: ["latin"],
  variable: "--font-sans-web",
});

const siteIndexable = isSiteIndexable();

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: defaultPublicSiteName,
  description:
    "Quality used vehicles, personal car sourcing and trusted repairs from one independent UK dealership.",
  robots: {
    index: siteIndexable,
    follow: siteIndexable,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      className={`${displayFont.variable} ${sansFont.variable}`}
    >
      <body>
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-white transition focus:translate-y-0"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
