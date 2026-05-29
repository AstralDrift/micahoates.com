"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { commands, type CommandKey } from "@/lib/site-content";

type CommandMenuProps = {
  open: boolean;
  onClose: () => void;
  onRun: (command: CommandKey) => void;
};

export function CommandMenu({ open, onClose, onRun }: CommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeCommand = useMemo(() => commands[selectedIndex], [selectedIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.activeElement;
    window.setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const isEscapeKey = (event: KeyboardEvent) => event.key === "Escape" || event.key === "Esc";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEscapeKey(event)) {
        event.preventDefault();
        onClose();
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % commands.length);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + commands.length) % commands.length);
      }

      if (event.key === "Enter") {
        event.preventDefault();
        onRun(activeCommand.key);
      }

      const shortcutCommand = commands.find((command) => command.shortcut === event.key.toLowerCase());
      if (shortcutCommand) {
        event.preventDefault();
        onRun(shortcutCommand.key);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isEscapeKey(event)) {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeCommand.key, onClose, onRun, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/56 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-menu-title"
            className="panel-border scanline w-full max-w-2xl p-3 shadow-[0_0_70px_rgba(73,221,255,0.12)]"
            onKeyDown={(event) => {
              if (event.key === "Escape" || event.key === "Esc") {
                event.preventDefault();
                onClose();
              }
            }}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
              <div>
                <h2 id="command-menu-title" className="text-sm text-slate-200">
                  Terminal command palette
                </h2>
                <p className="mt-1 text-xs text-slate-500">Choose a command, press Enter, or Esc to close.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="border border-white/15 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-white/35 hover:text-white"
              >
                esc
              </button>
            </div>

            <div className="mt-3 border border-emerald-300/50 bg-white/[0.03] px-3 py-3 text-sm text-slate-400">
              <span className="mr-2 text-emerald-300">&gt;</span>
              choose a terminal action
            </div>

            <div className="mt-3 space-y-1" aria-label="Available commands">
              {commands.map((command, index) => {
                const Icon = command.icon;
                const selected = index === selectedIndex;

                return (
                  <button
                    key={command.key}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => onRun(command.key)}
                    aria-current={selected ? "true" : undefined}
                    className="grid w-full grid-cols-[2.4rem_1fr_auto] items-center gap-3 px-3 py-3 text-left text-sm transition hover:bg-white/[0.06] data-[selected=true]:bg-cyan-300/12"
                    data-selected={selected}
                  >
                    <span className="grid size-9 place-items-center border border-white/10 text-slate-300">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-slate-100">{command.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{command.description}</span>
                    </span>
                    <kbd className="min-w-7 border border-white/15 px-2 py-1 text-center text-xs text-slate-300">
                      {command.shortcut}
                    </kbd>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-white/10 px-3 pt-3 text-xs text-slate-500">
              <span>↑↓ navigate</span>
              <span>Enter run</span>
              <span>Esc close</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
