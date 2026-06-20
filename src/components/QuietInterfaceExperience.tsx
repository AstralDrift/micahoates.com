"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { CommandPalette } from "@/components/CommandPalette";
import { QuietInterfaceCanvas } from "@/components/QuietInterfaceCanvas";
import { QuietTerminal, type RenderedTerminalLine } from "@/components/QuietTerminal";
import { commandSuggestions, parseCommand, pathSuggestions, runQuietCommand, shellPrompt } from "@/lib/quiet-interface/commands";
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

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function QuietInterfaceExperience() {
  const lineCounterRef = useRef(INITIAL_RENDERED_LINES.length);
  const signalCounterRef = useRef(INITIAL_TERMINAL_SIGNAL.nonce);
  const [state, setState] = useState<QuietInterfaceState>(() => createInitialState());
  const [lines, setLines] = useState<RenderedTerminalLine[]>(() => INITIAL_RENDERED_LINES);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [visibleHintKey, setVisibleHintKey] = useState<string | null>(null);
  const [inputActive, setInputActive] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [terminalSignal, setTerminalSignal] = useState<TerminalSignal>(() => INITIAL_TERMINAL_SIGNAL);
  const [pointer, setPointer] = useState({ x: 0, y: 0, active: false });
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

  const appendLines = useCallback(
    (nextLines: TerminalLine[]) => {
      setLines((current) => [...current, ...nextLines.map(makeLine)]);
    },
    [makeLine]
  );

  const emitTerminalSignal = useCallback((signal: Omit<TerminalSignal, "nonce">) => {
    signalCounterRef.current += 1;
    setTerminalSignal({
      ...signal,
      nonce: signalCounterRef.current
    });
  }, []);

  useEffect(() => {
    window.setTimeout(() => {
      const restoredState = restoreQuietSession(window.localStorage);
      setState(restoredState);
      setRenderedLines(introLines(restoredState));
    }, 0);
  }, [setRenderedLines]);

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
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const updateKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(inset > 48 ? Math.round(inset) : 0);
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
        setLines([]);
        return;
      }

      const result = runQuietCommand(command, state);
      const eventState =
        result.visualEvent && result.nextState.lastVisualEvent !== result.visualEvent
          ? { ...result.nextState, lastVisualEvent: result.visualEvent }
          : result.nextState;
      const nextState = {
        ...eventState,
        commandHistory: [...state.commandHistory.slice(-31), command]
      };

      if (parsed.command === "reset") {
        emitTerminalSignal({ event: "reset", input: "", submittedCommand: command });
        clearQuietSession(window.localStorage);
        setState(nextState);
        setRenderedLines([...introLines(nextState), ...result.output]);
        return;
      }

      persistQuietSession(window.localStorage, nextState);

      setState(nextState);
      appendLines([{ text: `> ${command}`, tone: "input" }, ...result.output]);
    },
    [appendLines, emitTerminalSignal, setRenderedLines, state]
  );

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    setPointer({
      x: event.clientX,
      y: event.clientY,
      active: true
    });
  };

  const handlePointerLeave = () => {
    setPointer((current) => ({
      ...current,
      active: false
    }));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
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
  };

  return (
    <main
      className="quiet-interface"
      style={{ "--keyboard-inset": `${keyboardInset}px` } as QuietInterfaceStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
      <QuietInterfaceCanvas
        phase={state.phase}
        signalLevel={state.signalLevel}
        puzzle={state}
        visualEvent={state.lastVisualEvent}
        terminalSignal={terminalSignal}
        pointer={pointer}
      />
      <QuietTerminal
        phase={state.phase}
        prompt={prompt}
        hint={visibleHintKey === hintKey && !inputActive && !paletteOpen ? hint : undefined}
        lines={lines}
        suggestions={suggestions}
        pathSuggestions={paths}
        onCommand={dispatchCommand}
        onInputActivity={(active) => {
          setInputActive(active);
          if (active) {
            setVisibleHintKey(null);
          }
        }}
        onTerminalSignal={emitTerminalSignal}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette
        open={paletteOpen}
        commands={suggestions}
        onClose={() => setPaletteOpen(false)}
        onRun={(command) => {
          setPaletteOpen(false);
          emitTerminalSignal({ event: "palette", input: "", submittedCommand: command });
          dispatchCommand(command);
        }}
      />
    </main>
  );
}
