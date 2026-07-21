import type { MetadataRoute } from "next";

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
    }
  ];
}
