"use client";

import { BrandSchematic } from "@/components/BrandSchematic";
import { site } from "@/lib/site-content";

type BrandSurfaceProps = {
  onEnterInterface: () => void;
};

export function BrandSurface({ onEnterInterface }: BrandSurfaceProps) {
  return (
    <div className="brand-surface">
      <div className="brand-atmosphere" aria-hidden="true" />
      <div className="brand-grain" aria-hidden="true" />

      <div className="brand-rail" aria-hidden="true">
        <span className="brand-rail-mark">{site.domain}</span>
        <span className="brand-rail-sep" />
        <span>surface</span>
        <span className="brand-rail-live">ready</span>
        <span className="brand-rail-spacer" />
        <span className="brand-rail-hint">
          press <kbd>i</kbd> for interface
        </span>
      </div>

      <header className="brand-hero">
        <div className="brand-copy">
          <p className="brand-eyebrow">Operator / systems</p>
          <h1 className="brand-name">{site.name}</h1>
          <p className="brand-headline">{site.headline}</p>
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
        </div>
        <div className="brand-stage">
          <BrandSchematic />
        </div>
      </header>
    </div>
  );
}
