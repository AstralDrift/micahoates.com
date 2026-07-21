"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { InterfacePhase, TerminalLineTone, TerminalSignal, TerminalSignalEvent } from "@/lib/quiet-interface/state";

export type RenderedTerminalLine = {
  id: string;
  text: string;
  tone?: TerminalLineTone;
  detail?: string;
  layout?: "plain" | "command-row";
};

export type TerminalAnchor = {
  x: number;
  y: number;
};

export type CommandStatus = "idle" | "ok" | "error";

type QuietTerminalProps = {
  phase: InterfacePhase;
  prompt: string;
  hint?: string;
  announcement: string;
  commandStatus: CommandStatus;
  lines: RenderedTerminalLine[];
  suggestions: string[];
  pathSuggestions: string[];
  onCommand: (command: string) => void;
  onInputActivity: (active: boolean) => void;
  onTerminalSignal: (signal: Pick<TerminalSignal, "event" | "input" | "submittedCommand">) => void;
  onTerminalAnchor: (anchor: TerminalAnchor) => void;
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
    case "final":
      return "quiet-line-final";
    case "muted":
      return "quiet-line-muted";
    default:
      return "quiet-line-default";
  }
}

function completeLastToken(input: string, candidates: string[]) {
  const tokenMatch = input.match(/(^|\s)([^\s]*)$/);
  const token = tokenMatch?.[2] ?? "";
  const prefix = token.startsWith("./") ? "./" : "";
  const normalizedToken = token.replace(/^\.\//, "").toLowerCase();
  const match = candidates.find((candidate) => candidate.toLowerCase().startsWith(normalizedToken));

  if (!match) {
    return input;
  }

  return `${input.slice(0, input.length - token.length)}${prefix}${match}`;
}

function shouldCompletePath(input: string) {
  const normalized = input.trimStart().toLowerCase();
  return (
    /^(cat|less|more|file|strings|readlink|cd|ls|tree|find)\s+/.test(normalized) ||
    /^grep\s+\S+\s+/.test(normalized) ||
    />\s*\S*$/.test(normalized)
  );
}

export function QuietTerminal({
  phase,
  prompt,
  hint,
  announcement,
  commandStatus,
  lines,
  suggestions,
  pathSuggestions,
  onCommand,
  onInputActivity,
  onTerminalSignal,
  onTerminalAnchor,
  onOpenPalette
}: QuietTerminalProps) {
  const [input, setInput] = useState("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const updateInput = useCallback((nextInput: string, event: TerminalSignalEvent) => {
    setInput(nextInput);
    onInputActivity(nextInput.length > 0);
    onTerminalSignal({ event, input: nextInput });
  }, [onInputActivity, onTerminalSignal]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const reportAnchor = () => {
      const rect = form.getBoundingClientRect();
      onTerminalAnchor({
        x: Math.round(rect.right - 8),
        y: Math.round(rect.top + rect.height / 2)
      });
    };

    reportAnchor();
    const observer = new ResizeObserver(reportAnchor);
    observer.observe(form);
    window.addEventListener("resize", reportAnchor);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reportAnchor);
    };
  }, [onTerminalAnchor]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const output = outputRef.current;
      if (output) {
        output.scrollTop = output.scrollHeight;
        const outputBounds = output.getBoundingClientRect();
        const partialLine = Array.from(output.querySelectorAll("p")).find((line) => {
          const lineBounds = line.getBoundingClientRect();
          return lineBounds.top < outputBounds.top && lineBounds.bottom > outputBounds.top;
        });

        if (partialLine) {
          const lineBounds = partialLine.getBoundingClientRect();
          output.scrollTop = Math.max(0, output.scrollTop - (outputBounds.top - lineBounds.top + 1));
        }
      }
      inputRef.current?.focus();
    });
  }, [lines]);

  const submit = () => {
    const command = input.trim();
    if (!command) {
      return;
    }

    if (command === "reset") {
      historyRef.current = [];
    } else {
      const history = historyRef.current;
      if (history[history.length - 1] !== command) {
        historyRef.current = [...history, command];
      }
    }
    historyIndexRef.current = null;
    setInput("");
    onInputActivity(false);
    onTerminalSignal({ event: "submit", input: "", submittedCommand: command });
    onCommand(command);
  };

  const autocomplete = () => {
    const nextInput = input.trim().toLowerCase().replace(/^\/+/, "");
    if (!nextInput) {
      return;
    }

    if (shouldCompletePath(nextInput)) {
      const completedPathInput = completeLastToken(nextInput, pathSuggestions);
      if (completedPathInput !== nextInput) {
        updateInput(completedPathInput, "autocomplete");
      }
      return;
    }

    const match = suggestions.find((suggestion) => suggestion.startsWith(nextInput));
    if (match) {
      updateInput(match, "autocomplete");
    }
  };

  const recallPrevious = useCallback(() => {
    const history = historyRef.current;
    if (history.length === 0) {
      return;
    }
    const historyIndex = historyIndexRef.current;
    const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
    historyIndexRef.current = nextIndex;
    updateInput(history[nextIndex], "history");
  }, [updateInput]);

  const recallNext = useCallback(() => {
    const history = historyRef.current;
    const historyIndex = historyIndexRef.current;
    if (history.length === 0 || historyIndex === null) {
      return;
    }
    const nextIndex = historyIndex + 1;
    if (nextIndex >= history.length) {
      historyIndexRef.current = null;
      updateInput("", "history");
      return;
    }
    historyIndexRef.current = nextIndex;
    updateInput(history[nextIndex], "history");
  }, [updateInput]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      onTerminalSignal({ event: "clear", input, submittedCommand: "clear" });
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

    if (event.key === "Escape" && input.length > 0) {
      event.preventDefault();
      updateInput("", "input");
      return;
    }

    if (event.key === "?" && input.length === 0) {
      event.preventDefault();
      onOpenPalette();
      return;
    }

    if (event.key === "/" && input.length === 0) {
      event.preventDefault();
      updateInput("/", "input");
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      recallPrevious();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      recallNext();
    }
  };

  const focusInputFromSurface = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      inputRef.current?.focus();
    }
  };

  return (
    <section
      className={`quiet-terminal quiet-terminal-${phase}`}
      data-command-status={commandStatus}
      aria-label="Quiet system interface"
      onPointerUp={focusInputFromSurface}
    >
      <div className="quiet-terminal-chrome">
        <span className="quiet-terminal-state-light" aria-hidden="true" />
        <span>interface.service</span>
        <strong>{phase}</strong>
        <span className="quiet-terminal-chrome-key" aria-hidden="true">?</span>
      </div>
      <div ref={outputRef} className="quiet-terminal-output" role="region" aria-label="Terminal transcript">
        {lines.map((line) =>
          line.text ? (
            <p key={line.id} className={toneClass(line.tone)} data-layout={line.layout ?? "plain"}>
              <span>{line.text}</span>
              {line.detail ? <span>{line.detail}</span> : null}
            </p>
          ) : (
            <br key={line.id} />
          )
        )}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div className="quiet-terminal-command">
        <div id="quiet-terminal-hint" className="quiet-terminal-hint" aria-live="polite">
          {hint}
        </div>
        <form
          ref={formRef}
          className="quiet-terminal-form"
          data-status={commandStatus}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label htmlFor="quiet-command-input" className="sr-only">
            Terminal command
          </label>
          <span className="quiet-terminal-prompt" aria-hidden="true">
            {prompt}
          </span>
          <input
            ref={inputRef}
            id="quiet-command-input"
            data-terminal-input="true"
            value={input}
            onChange={(event) => {
              updateInput(event.target.value, "input");
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCapitalize="none"
            aria-describedby="quiet-terminal-hint"
            aria-invalid={commandStatus === "error" ? true : undefined}
            enterKeyHint="send"
            spellCheck={false}
            placeholder="command"
          />
        </form>
        <div className="quiet-terminal-keys" aria-label="Terminal keys">
          <button type="button" aria-label="Complete command" onPointerDown={(event) => event.preventDefault()} onClick={autocomplete}>
            Tab
          </button>
          <button type="button" aria-label="Previous command" onPointerDown={(event) => event.preventDefault()} onClick={recallPrevious}>
            ↑
          </button>
          <button type="button" aria-label="Next command" onPointerDown={(event) => event.preventDefault()} onClick={recallNext}>
            ↓
          </button>
          <button type="button" aria-label="Open command palette" onPointerDown={(event) => event.preventDefault()} onClick={onOpenPalette}>
            ?
          </button>
          <button type="button" aria-label="Run command" onPointerDown={(event) => event.preventDefault()} onClick={submit}>
            Enter
          </button>
        </div>
      </div>
    </section>
  );
}
