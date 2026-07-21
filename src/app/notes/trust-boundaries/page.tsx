import type { Metadata } from "next";
import Link from "next/link";

import { trustBoundariesNote } from "@/content/trust-boundaries";
import { site } from "@/lib/site-content";

export const metadata: Metadata = {
  title: trustBoundariesNote.title,
  description: trustBoundariesNote.description,
  alternates: {
    canonical: `/notes/${trustBoundariesNote.slug}/`
  },
  openGraph: {
    title: `${trustBoundariesNote.title} | ${site.domain}`,
    description: trustBoundariesNote.description,
    url: `${site.url}/notes/${trustBoundariesNote.slug}/`
  }
};

export default function TrustBoundariesNotePage() {
  const paragraphs = trustBoundariesNote.body.trim().split(/\n\n+/);

  return (
    <main className="note-page">
      <div className="note-rail">
        <Link href="/">← {site.domain}</Link>
        <span className="note-rail-sep" aria-hidden="true" />
        <span>notes</span>
      </div>
      <article className="note-article">
        <p className="note-overline">Note · {trustBoundariesNote.published}</p>
        <h1 className="note-title">{trustBoundariesNote.title}</h1>
        <p className="note-dek">{trustBoundariesNote.description}</p>
        <div className="note-body">
          {paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>
      </article>
    </main>
  );
}
