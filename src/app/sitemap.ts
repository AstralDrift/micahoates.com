import type { MetadataRoute } from "next";

import { trustBoundariesNote } from "@/content/trust-boundaries";
import { site } from "@/lib/site-content";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const modified = new Date(site.lastModified);

  return [
    {
      url: site.url,
      lastModified: modified,
      changeFrequency: "monthly",
      priority: 1
    },
    {
      url: `${site.url}/notes/`,
      lastModified: modified,
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: `${site.url}/notes/${trustBoundariesNote.slug}/`,
      lastModified: new Date(trustBoundariesNote.published),
      changeFrequency: "yearly",
      priority: 0.7
    }
  ];
}
