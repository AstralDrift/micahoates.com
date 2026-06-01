"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

type CommandPaletteProps = {
  open: boolean;
  commands: string[];
  onClose: () => void;
  onRun: (command: string) => void;
};

export function CommandPalette({ open, commands, onClose, onRun }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const shortcutMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const command of commands) {
      const key = command[0]?.toLowerCase();
      if (key) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return new Map(commands.map((command) => {
      const key = command[0]?.toLowerCase() ?? "";
      return [command, key && counts.get(key) === 1 ? key : ""] as const;
    }));
  }, [commands]);

  const safeSelectedIndex = commands.length === 0 ? 0 : Math.min(selectedIndex, commands.length - 1);
  const selectedCommand = commands[safeSelectedIndex];

  useEffect(() => {
    if (!open) {
      return;
    }

    window.setTimeout(() => {
      setSelectedIndex(0);
      dialogRef.current?.focus();
    }, 0);
  }, [open]);

  useEffect(() => {
    itemRefs.current[safeSelectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [safeSelectedIndex]);

  if (!open) {
    return null;
  }

  const run = (command: string) => {
    onRun(command);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => (commands.length === 0 ? 0 : (index + 1) % commands.length));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => (commands.length === 0 ? 0 : (index - 1 + commands.length) % commands.length));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (selectedCommand) {
        run(selectedCommand);
      }
      return;
    }

    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1 && /^[a-z0-9]$/i.test(event.key)) {
      const key = event.key.toLowerCase();
      const exactShortcut = commands.find((command) => shortcutMap.get(command) === key);

      event.preventDefault();
      if (exactShortcut) {
        run(exactShortcut);
        return;
      }

      const matchingIndexes = commands.map((command, index) => ({ command, index })).filter(({ command }) => command.startsWith(key));
      if (matchingIndexes.length > 0) {
        const nextMatch = matchingIndexes.find(({ index }) => index > safeSelectedIndex) ?? matchingIndexes[0];
        setSelectedIndex(nextMatch.index);
      }
    }
  };

  return (
    <div className="quiet-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="quiet-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiet-palette-title"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="quiet-palette-header">
          <h2 id="quiet-palette-title">directive index</h2>
          <button type="button" onClick={onClose} aria-label="Close command palette">
            esc
          </button>
        </div>
        <div className="quiet-palette-list" aria-label="Discovered commands">
          {commands.map((command, index) => (
            <button
              key={command}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              data-selected={index === safeSelectedIndex}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => run(command)}
            >
              <span>{command}</span>
              <span>{shortcutMap.get(command) || "enter"}</span>
            </button>
          ))}
          {commands.length === 0 ? <p>no directives discovered</p> : null}
        </div>
      </div>
    </div>
  );
}
