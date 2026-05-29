"use client";

import { useCallback, useEffect, useState } from "react";

import { CommandMenu } from "@/components/command-menu";
import { HeroSection } from "@/components/hero-section";
import { type CommandKey } from "@/lib/site-content";

type CommandRequest = {
  command: CommandKey;
  id: number;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function HomeExperience() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [request, setRequest] = useState<CommandRequest | null>(null);

  const queueCommand = useCallback((command: CommandKey) => {
    setRequest((current) => ({ command, id: (current?.id ?? 0) + 1 }));
  }, []);

  const runCommand = useCallback(
    (command: CommandKey) => {
      setMenuOpen(false);
      document.getElementById("terminal")?.scrollIntoView({ behavior: "smooth", block: "center" });
      queueCommand(command);
    },
    [queueCommand]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isEscape = event.key === "Escape" || event.key === "Esc" || event.code === "Escape";

      if (menuOpen && isEscape) {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }

      if (event.key !== "?" || isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setMenuOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [menuOpen]);

  return (
    <>
      <main>
        <HeroSection commandRequest={request} onOpenCommandMenu={() => setMenuOpen(true)} />
      </main>
      <CommandMenu open={menuOpen} onClose={() => setMenuOpen(false)} onRun={runCommand} />
    </>
  );
}
