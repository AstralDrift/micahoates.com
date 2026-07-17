"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { BrandSurface } from "@/components/BrandSurface";
import { QuietInterfaceExperience } from "@/components/QuietInterfaceExperience";
import { SelectedWork } from "@/components/SelectedWork";
import { SiteFooter, SiteNote } from "@/components/SiteChrome";
import { isTypingTarget } from "@/lib/dom";
import { MORPH_ENTER_MS, MORPH_EXIT_MS } from "@/lib/morph";
import { restoreTraceProgress } from "@/lib/quiet-interface/session";
import {
  buildInterfaceHash,
  EMPTY_TRACE_PROGRESS,
  parseInterfaceHash,
  type TraceNode,
  type TraceProgress
} from "@/lib/world-state";

type Surface =
  | { kind: "brand" }
  | { kind: "to-interface"; node: TraceNode | null }
  | { kind: "interface"; node: TraceNode | null }
  | { kind: "to-brand"; node: TraceNode | null };

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function dataMode(surface: Surface): "brand" | "interface" {
  switch (surface.kind) {
    case "brand":
    case "to-brand":
      return "brand";
    case "to-interface":
    case "interface":
      return "interface";
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }
}

function dataTransition(surface: Surface): "idle" | "entering" | "exiting" {
  switch (surface.kind) {
    case "to-interface":
      return "entering";
    case "to-brand":
      return "exiting";
    case "brand":
    case "interface":
      return "idle";
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }
}

function surfaceNode(surface: Surface): TraceNode | null {
  switch (surface.kind) {
    case "brand":
      return null;
    case "to-interface":
    case "interface":
    case "to-brand":
      return surface.node;
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }
}

export function HomeExperience() {
  const [surface, setSurface] = useState<Surface>({ kind: "brand" });
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<TraceProgress>(EMPTY_TRACE_PROGRESS);
  const transitionTimer = useRef<number | null>(null);

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimer.current != null) {
      window.clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
  }, []);

  const enterInterface = useCallback(
    (node?: TraceNode) => {
      const nextNode = node ?? null;
      const hash = buildInterfaceHash(nextNode);
      if (window.location.hash !== hash) {
        window.history.replaceState(null, "", hash);
      }

      if (prefersReducedMotion() || surface.kind === "interface") {
        setSurface({ kind: "interface", node: nextNode });
        return;
      }

      setSurface({ kind: "to-interface", node: nextNode });
      clearTransitionTimer();
      transitionTimer.current = window.setTimeout(() => {
        setSurface({ kind: "interface", node: nextNode });
        transitionTimer.current = null;
      }, MORPH_ENTER_MS);
    },
    [clearTransitionTimer, surface.kind]
  );

  const exitInterface = useCallback(() => {
    if (window.location.hash.startsWith("#interface")) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    const node = surfaceNode(surface);

    if (prefersReducedMotion()) {
      setSurface({ kind: "brand" });
      return;
    }

    setSurface({ kind: "to-brand", node });
    clearTransitionTimer();
    transitionTimer.current = window.setTimeout(() => {
      setSurface({ kind: "brand" });
      transitionTimer.current = null;
    }, MORPH_EXIT_MS);
  }, [clearTransitionTimer, surface]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setProgress(restoreTraceProgress(window.localStorage));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      const parsed = parseInterfaceHash(window.location.hash);
      if (parsed.open) {
        setSurface({ kind: "interface", node: parsed.node });
      } else {
        setSurface({ kind: "brand" });
      }
    };

    const timeout = window.setTimeout(syncFromHash, 0);
    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, []);

  useEffect(() => () => clearTransitionTimer(), [clearTransitionTimer]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (
        surface.kind === "brand" &&
        (event.key === "i" || event.key === "I") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        enterInterface();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enterInterface, surface.kind]);

  const mode = dataMode(surface);
  const transition = dataTransition(surface);
  const entryNode = surfaceNode(surface);
  const showInterface = surface.kind === "interface" || surface.kind === "to-interface";
  const brandActive =
    surface.kind === "brand" || surface.kind === "to-brand" || surface.kind === "to-interface";

  useEffect(() => {
    if (showInterface || surface.kind === "to-brand") {
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.documentElement.style.overflow = "";
      };
    }

    return undefined;
  }, [showInterface, surface.kind]);

  return (
    <div
      className="home-experience"
      data-mode={mode}
      data-ready={ready ? "true" : "false"}
      data-transition={transition}
      style={
        {
          "--morph-enter-ms": `${MORPH_ENTER_MS}`,
          "--morph-exit-ms": `${MORPH_EXIT_MS}`
        } as CSSProperties
      }
    >
      <div
        className="home-brand-layer"
        data-active={brandActive ? "true" : "false"}
        aria-hidden={mode !== "brand"}
      >
        <BrandSurface onEnterInterface={enterInterface} activeNode={entryNode} progress={progress} />
        <SelectedWork />
        <SiteNote onEnterInterface={() => enterInterface()} />
        <SiteFooter />
      </div>
      <div
        className="home-interface-layer"
        data-active={showInterface ? "true" : "false"}
        aria-hidden={surface.kind !== "interface"}
      >
        {showInterface ? (
          <QuietInterfaceExperience
            onRequestExit={exitInterface}
            entryNode={entryNode}
            onProgress={setProgress}
          />
        ) : null}
      </div>
    </div>
  );
}
