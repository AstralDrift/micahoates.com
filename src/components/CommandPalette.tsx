"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { CommandDefinition } from "@/lib/quiet-interface/copy";

type CommandPaletteProps = {
  open: boolean;
  commands: CommandDefinition[];
  onClose: () => void;
  onRun: (command: string) => void;
};

export function CommandPalette({ open, commands, onClose, onRun }: CommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const shortcutMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const definition of commands) {
      const key = definition.command[0]?.toLowerCase();
      if (key) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return new Map(commands.map((definition) => {
      const key = definition.command[0]?.toLowerCase() ?? "";
      return [definition.command, key && counts.get(key) === 1 ? key : ""] as const;
    }));
  }, [commands]);

  const safeSelectedIndex = commands.length === 0 ? 0 : Math.min(selectedIndex, commands.length - 1);
  const selectedCommand = commands[safeSelectedIndex]?.command;

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      listRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timeout);
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

    if (event.key === "Tab") {
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      if (focusable.length === 0) {
        return;
      }

      const activeIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
      if ((!event.shiftKey && activeIndex === focusable.length - 1) || (event.shiftKey && activeIndex <= 0)) {
        event.preventDefault();
        focusable[event.shiftKey ? focusable.length - 1 : 0]?.focus();
      }
      return;
    }

    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1 && /^[a-z0-9]$/i.test(event.key)) {
      const key = event.key.toLowerCase();
      const exactShortcut = commands.find((definition) => shortcutMap.get(definition.command) === key)?.command;

      event.preventDefault();
      if (exactShortcut) {
        run(exactShortcut);
        return;
      }

      const matchingIndexes: Array<{ command: string; index: number }> = [];
      commands.forEach((definition, index) => {
        if (definition.command.startsWith(key)) {
          matchingIndexes.push({ command: definition.command, index });
        }
      });
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
        <div
          ref={listRef}
          className="quiet-palette-list"
          role="listbox"
          aria-label="Discovered commands"
          aria-activedescendant={selectedCommand ? `quiet-palette-option-${safeSelectedIndex}` : undefined}
          tabIndex={-1}
        >
          {commands.map((definition, index) => (
            <button
              key={definition.command}
              id={`quiet-palette-option-${index}`}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="option"
              aria-selected={index === safeSelectedIndex}
              data-selected={index === safeSelectedIndex}
              onPointerMove={() => setSelectedIndex(index)}
              onClick={() => run(definition.command)}
            >
              <span className="quiet-palette-command">
                <strong>{definition.command}</strong>
                <small>{definition.description}</small>
              </span>
              <span>{shortcutMap.get(definition.command) || "enter"}</span>
            </button>
          ))}
          {commands.length === 0 ? <p>no directives discovered</p> : null}
        </div>
      </div>
    </div>
  );
}
