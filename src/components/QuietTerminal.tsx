"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { InterfacePhase, TerminalLineTone } from "@/lib/quiet-interface/state";

export type RenderedTerminalLine = {
  id: string;
  text: string;
  tone?: TerminalLineTone;
};

type QuietTerminalProps = {
  phase: InterfacePhase;
  hint?: string;
  lines: RenderedTerminalLine[];
  suggestions: string[];
  onCommand: (command: string) => void;
  onInputActivity: (active: boolean) => void;
  onOpenPalette: () => void;
};

function toneClass(tone?: TerminalLineTone) {
  switch (tone) {
    case "accent":
      return "quiet-line-accent";
    case "warning":
      return "quiet-line-warning";
    case "error":
      return "quiet-line-error";
    case "input":
      return "quiet-line-input";
    case "muted":
      return "quiet-line-muted";
    default:
      return "quiet-line-default";
  }
}

export function QuietTerminal({ phase, hint, lines, suggestions, onCommand, onInputActivity, onOpenPalette }: QuietTerminalProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
      inputRef.current?.focus();
    });
  }, [lines]);

  const submit = () => {
    const command = input.trim();
    if (!command) {
      return;
    }

    setHistory((current) => (current[current.length - 1] === command ? current : [...current, command]));
    setHistoryIndex(null);
    setInput("");
    onInputActivity(false);
    onCommand(command);
  };

  const autocomplete = () => {
    const nextInput = input.trim().toLowerCase().replace(/^\/+/, "");
    if (!nextInput) {
      return;
    }

    const match = suggestions.find((suggestion) => suggestion.startsWith(nextInput));
    if (match) {
      setInput(match);
      onInputActivity(true);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      onCommand("clear");
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      submit();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      autocomplete();
      return;
    }

    if (event.key === "?" && input.length === 0) {
      event.preventDefault();
      onOpenPalette();
      return;
    }

    if (event.key === "/" && input.length === 0) {
      event.preventDefault();
      setInput("/");
      onInputActivity(true);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) {
        return;
      }
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex]);
      onInputActivity(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (history.length === 0 || historyIndex === null) {
        return;
      }
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setInput("");
        onInputActivity(false);
        return;
      }
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex]);
      onInputActivity(true);
    }
  };

  return (
    <section className="quiet-terminal" aria-label="Quiet system interface" onClick={() => inputRef.current?.focus()}>
      <div className="quiet-terminal-chrome" aria-hidden="true">
        <span>state</span>
        <strong>{phase}</strong>
        <span>?</span>
      </div>
      <div ref={outputRef} className="quiet-terminal-output" aria-live="polite">
        {lines.map((line) =>
          line.text ? (
            <p key={line.id} className={toneClass(line.tone)}>
              {line.text}
            </p>
          ) : (
            <br key={line.id} />
          )
        )}
      </div>
      <div className="quiet-terminal-command">
        <div className="quiet-terminal-hint" aria-live="polite">
          {hint}
        </div>
        <form
          className="quiet-terminal-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label htmlFor="quiet-command-input" className="sr-only">
            Terminal command
          </label>
          <span aria-hidden="true">&gt;</span>
          <input
            ref={inputRef}
            id="quiet-command-input"
            data-terminal-input="true"
            value={input}
            onChange={(event) => {
              const nextValue = event.target.value;
              setInput(nextValue);
              onInputActivity(nextValue.length > 0);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
            placeholder="command"
          />
        </form>
      </div>
    </section>
  );
}
