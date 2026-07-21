import type { Metadata } from "next";
import Link from "next/link";

import { trustBoundariesNote } from "@/content/trust-boundaries";
import { site } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Notes",
  description: "Short writing on systems, agents, and trust boundaries.",
  alternates: {
    canonical: "/notes/"
  }
};

export default function NotesIndexPage() {
  return (
    <main className="note-page">
      <div className="note-rail">
        <Link href="/">← {site.domain}</Link>
        <span className="note-rail-sep" aria-hidden="true" />
        <span>notes</span>
      </div>
      <section className="note-index">
        <h1 className="note-title">Notes</h1>
        <ul className="note-index-list">
          <li>
            <Link href={`/notes/${trustBoundariesNote.slug}/`}>{trustBoundariesNote.title}</Link>
            <p>{trustBoundariesNote.description}</p>
          </li>
        </ul>
      </section>
    </main>
  );
}
