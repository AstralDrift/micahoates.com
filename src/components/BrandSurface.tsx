"use client";

import { useEffect, useState } from "react";

import { BrandSchematic } from "@/components/BrandSchematic";
import { restoreTraceProgress } from "@/lib/quiet-interface/session";
import { site } from "@/lib/site-content";
import type { TraceNode, TraceProgress } from "@/lib/world-state";

type BrandSurfaceProps = {
  onEnterInterface: (node?: TraceNode) => void;
  activeNode: TraceNode | null;
  morphing: boolean;
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

const EMPTY_PROGRESS: TraceProgress = {
  carrier: false,
  signal: false,
  boundary: false,
  release: false
};

export function BrandSurface({ onEnterInterface, activeNode, morphing }: BrandSurfaceProps) {
  const [clock, setClock] = useState("");
  const [progress, setProgress] = useState<TraceProgress>(EMPTY_PROGRESS);

  useEffect(() => {
    const tick = () => setClock(formatRailTime(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const refresh = () => setProgress(restoreTraceProgress(window.localStorage));
    const timeout = window.setTimeout(refresh, 0);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return (
    <div className={`brand-surface${morphing ? " is-morphing" : ""}`}>
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
        <div className="brand-stage" data-morph-target="schematic">
          <BrandSchematic progress={progress} activeNode={activeNode} onEnterInterface={onEnterInterface} />
        </div>
      </header>
    </div>
  );
}
