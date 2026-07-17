"use client";

import { useCallback, useEffect, useState } from "react";

import { BrandSurface } from "@/components/BrandSurface";
import { QuietInterfaceExperience } from "@/components/QuietInterfaceExperience";
import { SelectedWork } from "@/components/SelectedWork";

type HomeMode = "brand" | "interface";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function HomeExperience() {
  const [mode, setMode] = useState<HomeMode>("brand");
  const [ready, setReady] = useState(false);

  const enterInterface = useCallback(() => {
    setMode("interface");
  }, []);

  const exitInterface = useCallback(() => {
    setMode("brand");
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (mode === "brand" && (event.key === "i" || event.key === "I") && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        enterInterface();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enterInterface, mode]);

  useEffect(() => {
    if (mode === "interface") {
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.documentElement.style.overflow = "";
      };
    }

    return undefined;
  }, [mode]);

  return (
    <div className="home-experience" data-mode={mode} data-ready={ready ? "true" : "false"}>
      <div className="home-brand-layer" data-active={mode === "brand" ? "true" : "false"} aria-hidden={mode !== "brand"}>
        <BrandSurface onEnterInterface={enterInterface} />
        <SelectedWork />
      </div>
      <div className="home-interface-layer" data-active={mode === "interface" ? "true" : "false"} aria-hidden={mode !== "interface"}>
        {mode === "interface" ? <QuietInterfaceExperience onRequestExit={exitInterface} /> : null}
      </div>
    </div>
  );
}
