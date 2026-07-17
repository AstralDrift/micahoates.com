import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import { site } from "@/lib/site-content";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap"
});

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
        alt: `${site.name} — systems console preview`
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
      sameAs: [site.githubUrl],
      knowsAbout: site.keywords.filter((keyword) => keyword !== site.name && keyword !== "interactive personal website")
    },
    {
      "@type": "CreativeWork",
      "@id": `${site.url}/#systems-surface`,
      name: site.title,
      url: site.url,
      creator: {
        "@id": `${site.url}/#person`
      },
      description:
        "A brand-first personal site with selected work and a deeper keyboard interface for contact discovery.",
      isAccessibleForFree: true
    }
  ]
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0B0D10",
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <head>
        {process.env.NODE_ENV === "development" ? (
          <>
            <Script
              src="//unpkg.com/react-grab/dist/index.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
            <Script
              src="//unpkg.com/react-scan/dist/auto.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
          </>
        ) : null}
      </head>
      <body>
        <noscript
          dangerouslySetInnerHTML={{
            __html: "<style>.quiet-js-fallback{display:grid!important}.site-shell{display:none!important}</style>"
          }}
        />
        <main className="quiet-noscript quiet-js-fallback" aria-label="Static brand surface">
          <section className="quiet-terminal quiet-terminal-message">
            <div className="quiet-terminal-chrome" aria-hidden="true">
              <span>state</span>
              <strong>limited</strong>
              <span>!</span>
            </div>
            <div className="quiet-terminal-output">
              <p className="quiet-line-input">{site.name}</p>
              <br />
              <p className="quiet-line-default">{site.headline}</p>
              <p className="quiet-line-muted">{site.support}</p>
              <br />
              <p className="quiet-line-muted">enable JavaScript for the full surface and interface</p>
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
