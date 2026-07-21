"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { CommandPalette } from "@/components/CommandPalette";
import { QuietInterfaceCanvas } from "@/components/QuietInterfaceCanvas";
import {
  QuietTerminal,
  type CommandStatus,
  type RenderedTerminalLine,
  type TerminalAnchor
} from "@/components/QuietTerminal";
import { isTypingTarget } from "@/lib/dom";
import {
  availableCommands,
  commandSuggestions,
  parseCommand,
  pathSuggestions,
  runQuietCommand,
  shellPrompt
} from "@/lib/quiet-interface/commands";
import { HINT_DELAY_MS, contextualHint } from "@/lib/quiet-interface/hints";
import { clearQuietSession, persistQuietSession, restoreQuietSession } from "@/lib/quiet-interface/session";
import { createInitialState, introLines, type QuietInterfaceState, type TerminalLine, type TerminalSignal } from "@/lib/quiet-interface/state";

const INITIAL_RENDERED_LINES: RenderedTerminalLine[] = introLines(createInitialState()).map((line, index) => ({
  id: `line-${index + 1}`,
  ...line
}));

const INITIAL_TERMINAL_SIGNAL: TerminalSignal = {
  input: "",
  event: "idle",
  nonce: 0
};

type QuietInterfaceStyle = CSSProperties & {
  "--keyboard-inset": string;
};

export function QuietInterfaceExperience() {
  const lineCounterRef = useRef(INITIAL_RENDERED_LINES.length);
  const signalCounterRef = useRef(INITIAL_TERMINAL_SIGNAL.nonce);
  const visualEventCounterRef = useRef(0);
  const [state, setState] = useState<QuietInterfaceState>(() => createInitialState());
  const [lines, setLines] = useState<RenderedTerminalLine[]>(() => INITIAL_RENDERED_LINES);
  const [announcement, setAnnouncement] = useState("");
  const [commandStatus, setCommandStatus] = useState<CommandStatus>("idle");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [visibleHintKey, setVisibleHintKey] = useState<string | null>(null);
  const [inputActive, setInputActive] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const terminalSignalRef = useRef<TerminalSignal>(INITIAL_TERMINAL_SIGNAL);
  const [visualEventNonce, setVisualEventNonce] = useState(0);
  const [terminalAnchor, setTerminalAnchor] = useState<TerminalAnchor>({ x: 0, y: 0 });
  const ignoredPointerRef = useRef(false);

  const makeLine = useCallback((line: TerminalLine): RenderedTerminalLine => {
    lineCounterRef.current += 1;
    return {
      id: `line-${lineCounterRef.current}`,
      ...line
    };
  }, []);

  const setRenderedLines = useCallback(
    (nextLines: TerminalLine[]) => {
      setLines(nextLines.map(makeLine));
    },
    [makeLine]
  );

  const setRenderedLinesRef = useRef(setRenderedLines);

  useEffect(() => {
    setRenderedLinesRef.current = setRenderedLines;
  }, [setRenderedLines]);

  const appendLines = useCallback(
    (nextLines: TerminalLine[]) => {
      setLines((current) => [...current, ...nextLines.map(makeLine)].slice(-240));
    },
    [makeLine]
  );

  const emitTerminalSignal = useCallback((signal: Omit<TerminalSignal, "nonce">) => {
    signalCounterRef.current += 1;
    terminalSignalRef.current = {
      ...signal,
      nonce: signalCounterRef.current
    };
  }, []);

  useEffect(() => {
    if (commandStatus === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCommandStatus("idle");
    }, commandStatus === "error" ? 1_100 : 760);

    return () => window.clearTimeout(timeout);
  }, [commandStatus]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const restoredState = restoreQuietSession(window.localStorage);
      setState(restoredState);
      setRenderedLinesRef.current(introLines(restoredState));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [paletteOpen]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const updateKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const nextInset = inset > 48 ? Math.round(inset) : 0;
      setKeyboardInset((current) => (current === nextInset ? current : nextInset));
    };

    updateKeyboardInset();
    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);

    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset);
      viewport.removeEventListener("scroll", updateKeyboardInset);
    };
  }, []);

  const suggestions = useMemo(() => commandSuggestions(state), [state]);
  const paletteCommands = useMemo(() => availableCommands(state), [state]);
  const paths = useMemo(() => pathSuggestions(state), [state]);
  const prompt = useMemo(() => shellPrompt(state), [state]);
  const hint = useMemo(() => contextualHint(state), [state]);
  const hintKey = `${state.phase}:${state.signalLevel}:${state.commandHistory.length}:${hint ?? ""}`;

  useEffect(() => {
    if (!hint || inputActive || paletteOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setVisibleHintKey(hintKey);
    }, HINT_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [hint, hintKey, inputActive, paletteOpen]);

  const openPalette = useCallback(() => {
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>("[data-terminal-input='true']")?.focus();
    });
  }, []);

  const handleInputActivity = useCallback((active: boolean) => {
    setInputActive(active);
    if (active) {
      setVisibleHintKey(null);
      setCommandStatus("idle");
    }
  }, []);

  const handleTerminalAnchor = useCallback((nextAnchor: TerminalAnchor) => {
    setTerminalAnchor((current) =>
      current.x === nextAnchor.x && current.y === nextAnchor.y ? current : nextAnchor
    );
  }, []);

  const dispatchCommand = useCallback(
    (rawCommand: string) => {
      const command = rawCommand.trim();
      if (!command) {
        return;
      }

      setVisibleHintKey(null);
      setInputActive(false);

      const parsed = parseCommand(command);

      if (parsed.command === "clear") {
        emitTerminalSignal({ event: "clear", input: "", submittedCommand: command });
        setState((current) => ({
          ...current,
          commandHistory: [...current.commandHistory.slice(-31), command]
        }));
        setLines([]);
        setAnnouncement("terminal transcript cleared");
        setCommandStatus("ok");
        return;
      }

      const result = runQuietCommand(command, state);
      const eventState = result.visualEvent
        ? { ...result.nextState, lastVisualEvent: result.visualEvent }
        : result.nextState;
      const nextState = {
        ...eventState,
        commandHistory: parsed.command === "reset" ? [] : [...state.commandHistory.slice(-31), command]
      };

      if (result.visualEvent) {
        visualEventCounterRef.current += 1;
        setVisualEventNonce(visualEventCounterRef.current);
      }

      const spokenOutput = result.output
        .reduce<string[]>((spokenLines, line) => {
          const spokenLine = [line.text, line.detail].filter(Boolean).join(": ");
          if (spokenLine) {
            spokenLines.push(spokenLine);
          }
          return spokenLines;
        }, [])
        .join(". ");
      setAnnouncement(spokenOutput || `working directory ${nextState.cwd}`);
      setCommandStatus(result.error ? "error" : "ok");

      if (parsed.command === "reset") {
        emitTerminalSignal({ event: "reset", input: "", submittedCommand: command });
        clearQuietSession(window.localStorage);
        setState(nextState);
        setRenderedLines([...introLines(nextState), ...result.output]);
        return;
      }

      persistQuietSession(window.localStorage, nextState);
      setState(nextState);
      const renderedResult = [{ text: `${shellPrompt(state)} ${command}`, tone: "input" } satisfies TerminalLine, ...result.output];
      if (result.visualEvent === "release") {
        setRenderedLines(renderedResult);
      } else {
        appendLines(renderedResult);
      }
    },
    [appendLines, emitTerminalSignal, setRenderedLines, state]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") {
      return;
    }

    if (ignoredPointerRef.current) {
      return;
    }

    if (event.target instanceof HTMLElement && event.target.closest("input, button, .quiet-palette")) {
      return;
    }

    ignoredPointerRef.current = true;
    appendLines([
      { text: "pointer input ignored", tone: "muted" },
      { text: "operator channel: keyboard only", tone: "muted" }
    ]);
    setAnnouncement("pointer input ignored. operator channel keyboard only");
  };

  return (
    <main
      className="quiet-interface"
      data-phase={state.phase}
      data-carrier={state.hasListened ? "sampled" : "unknown"}
      data-trace={state.hasTraced ? "resolved" : "unknown"}
      data-signal={state.hasDecodedSignal ? "locked" : state.hasListened && state.hasTraced ? "writable" : "unavailable"}
      data-boundary={state.boundaryOpen ? "open" : state.boundaryVisible ? "located" : "absent"}
      style={{ "--keyboard-inset": `${keyboardInset}px` } as QuietInterfaceStyle}
      onPointerDown={handlePointerDown}
    >
      <QuietInterfaceCanvas
        phase={state.phase}
        signalLevel={state.signalLevel}
        puzzle={state}
        visualEvent={state.lastVisualEvent}
        visualEventNonce={visualEventNonce}
        terminalSignalRef={terminalSignalRef}
        terminalAnchor={terminalAnchor}
      />
      <div className="quiet-mobile-instrument" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <QuietTerminal
        phase={state.phase}
        prompt={prompt}
        hint={visibleHintKey === hintKey && !inputActive && !paletteOpen ? hint : undefined}
        announcement={announcement}
        commandStatus={commandStatus}
        lines={lines}
        suggestions={suggestions}
        pathSuggestions={paths}
        onCommand={dispatchCommand}
        onInputActivity={handleInputActivity}
        onTerminalSignal={emitTerminalSignal}
        onTerminalAnchor={handleTerminalAnchor}
        onOpenPalette={openPalette}
      />
      {paletteOpen ? (
        <CommandPalette
          open
          commands={paletteCommands}
          onClose={closePalette}
          onRun={(command) => {
            closePalette();
            emitTerminalSignal({ event: "palette", input: "", submittedCommand: command });
            dispatchCommand(command);
          }}
        />
      ) : null}
    </main>
  );
}
