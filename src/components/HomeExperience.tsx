"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BrandSurface } from "@/components/BrandSurface";
import { QuietInterfaceExperience } from "@/components/QuietInterfaceExperience";
import { SelectedWork } from "@/components/SelectedWork";
import { SiteFooter, SiteNote } from "@/components/SiteChrome";
import {
  buildInterfaceHash,
  parseInterfaceHash,
  type TraceNode
} from "@/lib/world-state";

type HomeMode = "brand" | "interface";
type TransitionPhase = "idle" | "entering" | "exiting";

const MORPH_MS = 720;
const MORPH_REVERSE_MS = 480;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HomeExperience() {
  const [mode, setMode] = useState<HomeMode>("brand");
  const [ready, setReady] = useState(false);
  const [entryNode, setEntryNode] = useState<TraceNode | null>(null);
  const [transition, setTransition] = useState<TransitionPhase>("idle");
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
      setEntryNode(nextNode);
      const hash = buildInterfaceHash(nextNode);
      if (window.location.hash !== hash) {
        window.history.replaceState(null, "", hash);
      }

      if (prefersReducedMotion() || mode === "interface") {
        setTransition("idle");
        setMode("interface");
        return;
      }

      setTransition("entering");
      clearTransitionTimer();
      transitionTimer.current = window.setTimeout(() => {
        setMode("interface");
        setTransition("idle");
        transitionTimer.current = null;
      }, MORPH_MS);
    },
    [clearTransitionTimer, mode]
  );

  const exitInterface = useCallback(() => {
    if (window.location.hash.startsWith("#interface")) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    if (prefersReducedMotion()) {
      setTransition("idle");
      setMode("brand");
      setEntryNode(null);
      return;
    }

    setTransition("exiting");
    setMode("brand");
    clearTransitionTimer();
    transitionTimer.current = window.setTimeout(() => {
      setEntryNode(null);
      setTransition("idle");
      transitionTimer.current = null;
    }, MORPH_REVERSE_MS);
  }, [clearTransitionTimer]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      const parsed = parseInterfaceHash(window.location.hash);
      if (parsed.open) {
        setEntryNode(parsed.node);
        setMode("interface");
        setTransition("idle");
      } else {
        setMode("brand");
        setEntryNode(null);
        setTransition("idle");
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

      if (mode === "brand" && transition === "idle" && (event.key === "i" || event.key === "I") && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        enterInterface();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enterInterface, mode, transition]);

  useEffect(() => {
    if (mode === "interface" || transition === "entering" || transition === "exiting") {
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.documentElement.style.overflow = "";
      };
    }

    return undefined;
  }, [mode, transition]);

  const showInterface = mode === "interface" || transition === "entering";
  const morphing = transition !== "idle";

  return (
    <div
      className="home-experience"
      data-mode={mode}
      data-ready={ready ? "true" : "false"}
      data-transition={transition}
    >
      <div
        className="home-brand-layer"
        data-active={mode === "brand" || transition === "exiting" || transition === "entering" ? "true" : "false"}
        aria-hidden={mode !== "brand"}
      >
        <BrandSurface onEnterInterface={enterInterface} activeNode={entryNode} morphing={morphing} />
        <SelectedWork />
        <SiteNote onEnterInterface={() => enterInterface()} />
        <SiteFooter />
      </div>
      <div
        className="home-interface-layer"
        data-active={showInterface ? "true" : "false"}
        aria-hidden={mode !== "interface"}
      >
        {showInterface ? (
          <QuietInterfaceExperience onRequestExit={exitInterface} entryNode={entryNode} />
        ) : null}
      </div>
    </div>
  );
}
