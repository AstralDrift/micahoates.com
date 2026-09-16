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
import { milestoneDuration } from "@/lib/quiet-interface/canvas-model";
import {
  availableCommands,
  commandSuggestions,
  fullShellPrompt,
  parseCommand,
  pathSuggestions,
  runQuietCommand,
  shellPrompt
} from "@/lib/quiet-interface/commands";
import { HINT_DELAY_MS, contextualHint } from "@/lib/quiet-interface/hints";
import { clearQuietSession, persistQuietSession, restoreQuietSession } from "@/lib/quiet-interface/session";
import {
  createInitialState,
  hasBuiltImage,
  hasDecodedSignal,
  hasReadCarrier,
  hasReadTrace,
  hasVerifiedImage,
  introLines,
  isBoundaryAttached,
  recordHintUsed,
  type QuietInterfaceState,
  type TerminalLine,
  type TerminalSignal,
  type VisualEvent
} from "@/lib/quiet-interface/state";

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

function boundaryAttribute(state: QuietInterfaceState): string {
  if (state.progress.kind === "outside") return "detached";
  if (isBoundaryAttached(state)) return "mounted";
  if (hasVerifiedImage(state)) return "verified";
  if (hasBuiltImage(state)) return "built";
  return "absent";
}

export function QuietInterfaceExperience() {
  const lineCounterRef = useRef(INITIAL_RENDERED_LINES.length);
  const signalCounterRef = useRef(INITIAL_TERMINAL_SIGNAL.nonce);
  const visualEventCounterRef = useRef(0);
  const busyRef = useRef(false);
  const busyTimeoutRef = useRef<number | null>(null);
  const pendingTranscriptRef = useRef<TerminalLine[] | null>(null);
  const pendingAnnouncementRef = useRef<string | null>(null);
  const [state, setState] = useState<QuietInterfaceState>(() => createInitialState());
  const [lines, setLines] = useState<RenderedTerminalLine[]>(() => INITIAL_RENDERED_LINES);
  const [announcement, setAnnouncement] = useState("");
  const [commandStatus, setCommandStatus] = useState<CommandStatus>("idle");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [visibleHintKey, setVisibleHintKey] = useState<string | null>(null);
  const [inputActive, setInputActive] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [busyEvent, setBusyEvent] = useState<VisualEvent | undefined>();
  const [settleNonce, setSettleNonce] = useState(0);
  const terminalSignalRef = useRef<TerminalSignal>(INITIAL_TERMINAL_SIGNAL);
  const [visualEventNonce, setVisualEventNonce] = useState(0);
  const [terminalAnchor, setTerminalAnchor] = useState<TerminalAnchor>({ x: 0, y: 0 });
  const ignoredPointerRef = useRef(false);

  const makeLine = useCallback((line: TerminalLine): RenderedTerminalLine => {
    lineCounterRef.current += 1;
    return { id: `line-${lineCounterRef.current}`, ...line };
  }, []);

  const setRenderedLines = useCallback((nextLines: TerminalLine[]) => {
    setLines(nextLines.map(makeLine));
  }, [makeLine]);

  const setRenderedLinesRef = useRef(setRenderedLines);
  useEffect(() => {
    setRenderedLinesRef.current = setRenderedLines;
  }, [setRenderedLines]);

  const appendLines = useCallback((nextLines: TerminalLine[]) => {
    setLines((current) => [...current, ...nextLines.map(makeLine)].slice(-240));
  }, [makeLine]);

  const emitTerminalSignal = useCallback((signal: Omit<TerminalSignal, "nonce">) => {
    signalCounterRef.current += 1;
    terminalSignalRef.current = { ...signal, nonce: signalCounterRef.current };
  }, []);

  const settleMilestone = useCallback(() => {
    if (busyTimeoutRef.current !== null) window.clearTimeout(busyTimeoutRef.current);
    busyTimeoutRef.current = null;
    busyRef.current = false;
    setBusyEvent(undefined);
    setSettleNonce((current) => current + 1);
    const pendingTranscript = pendingTranscriptRef.current;
    if (pendingTranscript) {
      pendingTranscriptRef.current = null;
      setRenderedLinesRef.current(pendingTranscript);
    }
    const pendingAnnouncement = pendingAnnouncementRef.current;
    if (pendingAnnouncement) {
      pendingAnnouncementRef.current = null;
      setAnnouncement(pendingAnnouncement);
    }
  }, []);

  const startMilestone = useCallback((event: VisualEvent | undefined) => {
    const duration = event ? milestoneDuration(event) : 0;
    if (!event || duration === 0 || reducedMotion) {
      settleMilestone();
      return;
    }
    if (busyTimeoutRef.current !== null) window.clearTimeout(busyTimeoutRef.current);
    busyRef.current = true;
    setBusyEvent(event);
    busyTimeoutRef.current = window.setTimeout(settleMilestone, duration);
  }, [reducedMotion, settleMilestone]);

  useEffect(() => () => {
    if (busyTimeoutRef.current !== null) window.clearTimeout(busyTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (commandStatus === "idle") return;
    const timeout = window.setTimeout(() => setCommandStatus("idle"), commandStatus === "error" ? 1_100 : 760);
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
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion && busyRef.current) settleMilestone();
  }, [reducedMotion, settleMilestone]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Escape" || event.key === "Esc") && busyRef.current) {
        event.preventDefault();
        settleMilestone();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === "?") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [settleMilestone]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
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
  const fullPrompt = useMemo(() => fullShellPrompt(state), [state]);
  const hint = useMemo(() => contextualHint(state), [state]);
  const hintKey = `${state.progress.kind}:${hint?.id ?? "none"}`;
  const interfaceStyle: QuietInterfaceStyle = { "--keyboard-inset": `${keyboardInset}px` };

  useEffect(() => {
    if (!hint || inputActive || paletteOpen || busyEvent) return;
    const timeout = window.setTimeout(() => {
      setVisibleHintKey(hintKey);
      if (!hint.countsTowardSolve) return;
      setState((current) => {
        const next = recordHintUsed(current, hint.id);
        if (next !== current) persistQuietSession(window.localStorage, next);
        return next;
      });
    }, HINT_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [busyEvent, hint, hintKey, inputActive, paletteOpen]);

  const openPalette = useCallback(() => {
    if (!busyRef.current) setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>("[data-terminal-input='true']")?.focus());
  }, []);

  const handleInputActivity = useCallback((active: boolean) => {
    setInputActive(active);
    if (active) {
      setVisibleHintKey(null);
      setCommandStatus("idle");
    }
  }, []);

  const handleTerminalAnchor = useCallback((nextAnchor: TerminalAnchor) => {
    setTerminalAnchor((current) => current.x === nextAnchor.x && current.y === nextAnchor.y ? current : nextAnchor);
  }, []);

  const dispatchCommand = useCallback((rawCommand: string) => {
    if (busyRef.current) return;
    const command = rawCommand.trim();
    if (!command) return;

    setVisibleHintKey(null);
    setInputActive(false);
    const parsed = parseCommand(command);
    const result = runQuietCommand(command, state);
    const nextState = result.nextState;

    if (result.visualEvent) {
      visualEventCounterRef.current += 1;
      setVisualEventNonce(visualEventCounterRef.current);
    }

    const spokenOutput = result.output
      .reduce<string[]>((spokenLines, line) => {
        const spokenLine = [line.text, line.detail].filter(Boolean).join(": ");
        if (spokenLine) spokenLines.push(spokenLine);
        return spokenLines;
      }, [])
      .join(". ");
    const nextAnnouncement = spokenOutput || `working directory ${nextState.cwd}`;
    setCommandStatus(result.error ? "error" : "ok");

    if (parsed.command === "reset") clearQuietSession(window.localStorage);
    else persistQuietSession(window.localStorage, nextState);
    setState(nextState);

    const renderedResult = [{ text: `${shellPrompt(state)} ${command}`, tone: "input" } satisfies TerminalLine, ...result.output];
    pendingTranscriptRef.current = null;
    pendingAnnouncementRef.current = null;
    if (result.transcript === "clear") setLines([]);
    else if (result.transcript === "replace") {
      if (result.visualEvent === "release") {
        pendingTranscriptRef.current = renderedResult;
        pendingAnnouncementRef.current = nextAnnouncement;
        setAnnouncement("release in progress");
        setRenderedLines(renderedResult.slice(0, 1));
      } else {
        setAnnouncement(nextAnnouncement);
        setRenderedLines(parsed.command === "reset" ? [...introLines(nextState), ...result.output] : renderedResult);
      }
    } else {
      setAnnouncement(nextAnnouncement);
      appendLines(renderedResult);
    }

    startMilestone(result.visualEvent);
  }, [appendLines, setRenderedLines, startMilestone, state]);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || ignoredPointerRef.current) return;
    if (event.target instanceof HTMLElement && event.target.closest("input, button, .quiet-palette")) return;
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
      data-phase={state.progress.kind}
      data-visual-event={busyEvent ?? state.lastVisualEvent ?? "idle"}
      data-carrier={hasReadCarrier(state) ? "sampled" : "unknown"}
      data-trace={hasReadTrace(state) ? "resolved" : "unknown"}
      data-signal={hasDecodedSignal(state) ? "locked" : hasReadCarrier(state) && hasReadTrace(state) ? "writable" : "unavailable"}
      data-boundary={boundaryAttribute(state)}
      style={interfaceStyle}
      onPointerDown={handlePointerDown}
    >
      <QuietInterfaceCanvas
        state={state}
        visualEvent={state.lastVisualEvent}
        visualEventNonce={visualEventNonce}
        settleNonce={settleNonce}
        terminalSignalRef={terminalSignalRef}
        terminalAnchor={terminalAnchor}
      />
      <QuietTerminal
        phase={state.progress.kind}
        prompt={prompt}
        fullPrompt={fullPrompt}
        hint={visibleHintKey === hintKey && !inputActive && !paletteOpen ? hint?.text : undefined}
        announcement={announcement}
        commandStatus={commandStatus}
        lines={lines}
        suggestions={suggestions}
        pathSuggestions={paths}
        busy={Boolean(busyEvent)}
        onSettle={settleMilestone}
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
