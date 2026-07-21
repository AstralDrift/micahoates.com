import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { site } from "@/lib/site-content";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.title} | ${site.domain}`,
    template: `%s | ${site.domain}`
  },
  description: site.description,
  keywords: [...site.keywords],
  applicationName: site.domain,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  publisher: site.name,
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
        sizes: "64x64"
      }
    ],
    shortcut: "/icon.svg",
    apple: "/apple-icon.svg"
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.domain,
    title: `${site.title} | ${site.domain}`,
    description: site.description,
    images: [
      {
        url: "/opengraph-image.svg",
        width: 1200,
        height: 630,
        alt: "A sparse signal apparatus on a black system surface"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.title} | ${site.domain}`,
    description: site.description,
    images: ["/opengraph-image.svg"]
  },
  robots: {
    index: true,
    follow: true
  }
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      url: site.url,
      name: site.domain,
      description: site.description,
      inLanguage: "en-US",
      publisher: {
        "@id": `${site.url}/#person`
      }
    },
    {
      "@type": "Person",
      "@id": `${site.url}/#person`,
      name: site.name,
      url: site.url,
      description: "Author of the system interface at micahoates.com."
    },
    {
      "@type": "CreativeWork",
      "@id": `${site.url}/#systems-surface`,
      name: site.title,
      url: site.url,
      creator: {
        "@id": `${site.url}/#person`
      },
      description: "A deterministic keyboard interface built as an interactive atmospheric artifact.",
      isAccessibleForFree: true
    }
  ]
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#030806",
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
        <noscript
          dangerouslySetInnerHTML={{
            __html: "<style>.quiet-js-fallback{display:grid!important}.site-shell{display:none!important}</style>"
          }}
        />
        <main className="quiet-noscript quiet-js-fallback" aria-label="Static system interface">
          <section className="quiet-terminal quiet-terminal-message">
            <div className="quiet-terminal-chrome" aria-hidden="true">
              <span>state</span>
              <strong>limited</strong>
              <span>!</span>
            </div>
            <div className="quiet-terminal-output">
              <p className="quiet-line-input">operator channel unavailable</p>
              <p className="quiet-line-default">the interface requires a local JavaScript runtime</p>
              <br />
              <p className="quiet-line-muted">no fallback transcript was provided</p>
            </div>
          </section>
        </main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData)
          }}
        />
        <div className="site-shell">{children}</div>
      </body>
    </html>
  );
}
