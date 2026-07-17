import { site } from "@/lib/site-content";

type SiteNoteProps = {
  onEnterInterface: () => void;
};

export function SiteNote({ onEnterInterface }: SiteNoteProps) {
  return (
    <section className="site-note" aria-label="Contact note">
      <p className="site-note-overline">Channel</p>
      <p className="site-note-body">
        Contact is revealed inside the interface after the release path. No forms. No trackers. Local
        session only.
      </p>
      <button type="button" className="site-note-link" onClick={onEnterInterface}>
        Open interface →
      </button>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span className="site-footer-mark">{site.domain}</span>
      <span className="site-footer-sep" aria-hidden="true" />
      <a href={site.githubUrl} target="_blank" rel="noreferrer noopener">
        GitHub
      </a>
      <span className="site-footer-spacer" aria-hidden="true" />
      <span>no analytics · static export</span>
    </footer>
  );
}
