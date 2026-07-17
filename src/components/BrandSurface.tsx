"use client";

import { site } from "@/lib/site-content";

type BrandSurfaceProps = {
  onEnterInterface: () => void;
};

export function BrandSurface({ onEnterInterface }: BrandSurfaceProps) {
  return (
    <div className="brand-surface">
      <div className="brand-atmosphere" aria-hidden="true" />
      <header className="brand-hero">
        <p className="brand-name">{site.name}</p>
        <h1 className="brand-headline">{site.headline}</h1>
        <p className="brand-support">{site.support}</p>
        <div className="brand-cta-group">
          <button type="button" className="brand-cta-primary" onClick={onEnterInterface}>
            Enter interface
            <span className="brand-cta-kbd" aria-hidden="true">
              i
            </span>
          </button>
          <a className="brand-cta-secondary" href="#selected-work">
            Selected work
          </a>
        </div>
      </header>
    </div>
  );
}
