"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CommandPalette } from "@/components/CommandPalette";
import { QuietInterfaceCanvas } from "@/components/QuietInterfaceCanvas";
import { QuietTerminal, type RenderedTerminalLine } from "@/components/QuietTerminal";
import { commandSuggestions, parseCommand, runQuietCommand } from "@/lib/quiet-interface/commands";
import {
  createInitialState,
  createReleasedState,
  introLines,
  type QuietInterfaceState,
  type TerminalLine
} from "@/lib/quiet-interface/state";

const STORAGE_KEY = "quiet-interface-state";
const HINT_DELAY_MS = 900;
const INITIAL_RENDERED_LINES: RenderedTerminalLine[] = introLines(createInitialState()).map((line, index) => ({
  id: `line-${index + 1}`,
  ...line
}));

type StoredQuietInterfaceState = {
  hasReleased?: boolean;
  lastPhase?: QuietInterfaceState["phase"];
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function contextualHint(state: QuietInterfaceState) {
  if (!state.hasWoken) {
    return "try: wake";
  }

  if (state.phase === "observation") {
    if (!state.hasListened) {
      return "next: listen";
    }
    if (!state.hasTraced) {
      return "next: trace";
    }
    return "next: make signal";
  }

  if (state.phase === "assembly") {
    return "next: make signal";
  }

  if (state.phase === "boundary") {
    if (!state.boundaryOpen) {
      return "next: open boundary";
    }
    if (!state.hasEntered) {
      return "next: enter";
    }
    return "next: release";
  }

  if (state.phase === "inside") {
    return "next: release";
  }

  if (state.phase === "outside") {
    return "try: contact";
  }

  return undefined;
}

export function QuietInterfaceExperience() {
  const lineCounterRef = useRef(INITIAL_RENDERED_LINES.length);
  const [state, setState] = useState<QuietInterfaceState>(() => createInitialState());
  const [lines, setLines] = useState<RenderedTerminalLine[]>(() => INITIAL_RENDERED_LINES);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [visibleHintKey, setVisibleHintKey] = useState<string | null>(null);
  const [inputActive, setInputActive] = useState(false);
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

  useEffect(() => {
    window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const initialState = createInitialState();
        setState(initialState);
        setRenderedLines(introLines(initialState));
        return;
      }

      try {
        const parsed = JSON.parse(stored) as StoredQuietInterfaceState;
        const restoredState = parsed.hasReleased ? createReleasedState() : createInitialState();
        setState(restoredState);
        setRenderedLines(introLines(restoredState));
      } catch {
        const initialState = createInitialState();
        setState(initialState);
        setRenderedLines(introLines(initialState));
      }
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

  const suggestions = useMemo(() => commandSuggestions(state), [state]);
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
        setLines([]);
        return;
      }

      const result = runQuietCommand(command, state);
      const nextState = {
        ...result.nextState,
        commandHistory: [...state.commandHistory.slice(-31), command]
      };

      if (parsed.command === "reset") {
        window.localStorage.removeItem(STORAGE_KEY);
        setState(nextState);
        setRenderedLines([...introLines(nextState), ...result.output]);
        return;
      }

      if (nextState.hasReleased) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            hasReleased: true,
            lastPhase: nextState.phase
          } satisfies StoredQuietInterfaceState)
        );
      }

      setState(nextState);
      appendLines([{ text: `> ${command}`, tone: "input" }, ...result.output]);
    },
    [appendLines, setRenderedLines, state]
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
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
      <QuietInterfaceCanvas phase={state.phase} signalLevel={state.signalLevel} visualEvent={state.lastVisualEvent} pointer={pointer} />
      <QuietTerminal
        phase={state.phase}
        hint={visibleHintKey === hintKey && !inputActive && !paletteOpen ? hint : undefined}
        lines={lines}
        suggestions={suggestions}
        onCommand={dispatchCommand}
        onInputActivity={(active) => {
          setInputActive(active);
          if (active) {
            setVisibleHintKey(null);
          }
        }}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette
        open={paletteOpen}
        commands={suggestions}
        onClose={() => setPaletteOpen(false)}
        onRun={(command) => {
          setPaletteOpen(false);
          dispatchCommand(command);
        }}
      />
    </main>
  );
}
