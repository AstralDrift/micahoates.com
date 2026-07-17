"use client";

import { useEffect, useState } from "react";

import { BrandSchematic } from "@/components/BrandSchematic";
import { site } from "@/lib/site-content";
import type { TraceNode, TraceProgress } from "@/lib/world-state";

type BrandSurfaceProps = {
  onEnterInterface: (node?: TraceNode) => void;
  activeNode: TraceNode | null;
  progress: TraceProgress;
};

function formatRailTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(date);
}

export function BrandSurface({ onEnterInterface, activeNode, progress }: BrandSurfaceProps) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(formatRailTime(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="brand-surface">
      <div className="brand-atmosphere" aria-hidden="true" />
      <div className="brand-grain" aria-hidden="true" />

      <div className="brand-rail">
        <span className="brand-rail-mark">{site.domain}</span>
        <span className="brand-rail-sep" aria-hidden="true" />
        <span>surface</span>
        <span className="brand-rail-live">ready</span>
        <span className="brand-rail-spacer" aria-hidden="true" />
        {clock ? (
          <span className="brand-rail-clock" aria-live="off">
            {clock}
          </span>
        ) : (
          <span className="brand-rail-clock brand-rail-clock-pending" aria-hidden="true">
            --:--:--
          </span>
        )}
        <span className="brand-rail-hint">
          press <kbd>i</kbd> or open a node
        </span>
      </div>

      <header className="brand-hero">
        <div className="brand-copy">
          <p className="brand-eyebrow">Operator / systems</p>
          <h1 className="brand-name">{site.name}</h1>
          <p className="brand-headline">{site.headline}</p>
          <p className="brand-support">{site.support}</p>
          <div className="brand-cta-group">
            <button type="button" className="brand-cta-primary" onClick={() => onEnterInterface()}>
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
          <BrandSchematic progress={progress} activeNode={activeNode} onEnterInterface={onEnterInterface} />
        </div>
      </header>
    </div>
  );
}
