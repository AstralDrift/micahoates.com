import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { BackgroundField } from "@/components/background-field";
import { site } from "@/lib/site-content";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | Platform engineer and systems builder`,
    template: `%s | ${site.name}`
  },
  description: site.description,
  applicationName: site.domain,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.name,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.domain,
    title: `${site.name} | Platform engineer and systems builder`,
    description: site.description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${site.name} personal website preview`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} | Platform engineer and systems builder`,
    description: site.description,
    images: ["/opengraph-image"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#03070c",
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <BackgroundField />
          {children}
        </div>
      </body>
    </html>
  );
}
