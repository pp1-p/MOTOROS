import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "DealerOS | Independent motoring, properly handled",
    template: "%s | DealerOS",
  },
  description:
    "Quality used vehicles, personal car sourcing and trusted repairs from one independent UK dealership.",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "DealerOS",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
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
