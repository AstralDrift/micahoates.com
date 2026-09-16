import type { PuzzleGate } from "@/lib/quiet-interface/puzzle-spec";

export type ObservationProgress =
  | { carrierRead: false; traceRead: false }
  | { carrierRead: true; traceRead: false }
  | { carrierRead: false; traceRead: true };

export type AfterimageProgress = "hidden" | "identified" | "decoded";

export type PuzzleProgress =
  | { kind: "dormant" }
  | { kind: "observing"; observation: ObservationProgress }
  | { kind: "decoding" }
  | { kind: "signal-locked" }
  | { kind: "image-built" }
  | { kind: "image-verified" }
  | { kind: "mounted" }
  | { kind: "inside" }
  | { kind: "outside"; afterimage: AfterimageProgress };

export type InterfacePhase = PuzzleProgress["kind"];

export type VisualEvent =
  | "boot"
  | "carrier-inspect"
  | "trace-inspect"
  | "signal-lock"
  | "signal-error"
  | "image-build"
  | "image-verify"
  | "mount"
  | "hint"
  | "inspect"
  | "enter"
  | "release"
  | "error"
  | "reset";

export type TerminalSignalEvent = "idle" | "input" | "autocomplete" | "history" | "submit" | "palette" | "clear" | "reset";

export type TerminalSignal = {
  input: string;
  submittedCommand?: string;
  event: TerminalSignalEvent;
  nonce: number;
};

export type TerminalLineTone = "default" | "muted" | "accent" | "warning" | "error" | "input" | "final";

export type TerminalLine = {
  text: string;
  tone?: TerminalLineTone;
  detail?: string;
  layout?: "plain" | "command-row";
};

export type FailureCounts = Record<PuzzleGate, number>;

export type PuzzleMetrics = {
  commandCount: number;
  signalAttempts: number;
  failures: FailureCounts;
  hintsUsed: string[];
};

export type QuietInterfaceState = {
  progress: PuzzleProgress;
  cwd: string;
  metrics: PuzzleMetrics;
  commandHistory: string[];
  lastVisualEvent?: VisualEvent;
};

export type CommandTranscriptMode = "append" | "clear" | "replace";

export type CommandResult = {
  nextState: QuietInterfaceState;
  output: TerminalLine[];
  visualEvent?: VisualEvent;
  transcript?: CommandTranscriptMode;
  error?: boolean;
};

const PROGRESS_ORDER: InterfacePhase[] = [
  "dormant",
  "observing",
  "decoding",
  "signal-locked",
  "image-built",
  "image-verified",
  "mounted",
  "inside",
  "outside"
];

export function createInitialMetrics(): PuzzleMetrics {
  return {
    commandCount: 0,
    signalAttempts: 0,
    failures: {
      signal: 0,
      verification: 0,
      mount: 0
    },
    hintsUsed: []
  };
}

export function createInitialState(): QuietInterfaceState {
  return {
    progress: { kind: "dormant" },
    cwd: "/",
    metrics: createInitialMetrics(),
    commandHistory: []
  };
}

export function createReleasedState(): QuietInterfaceState {
  return {
    progress: { kind: "outside", afterimage: "hidden" },
    cwd: "/outside",
    metrics: createInitialMetrics(),
    commandHistory: [],
    lastVisualEvent: "release"
  };
}

export function phaseForState(state: QuietInterfaceState): InterfacePhase {
  return state.progress.kind;
}

export function progressAtLeast(progress: PuzzleProgress, phase: InterfacePhase): boolean {
  return PROGRESS_ORDER.indexOf(progress.kind) >= PROGRESS_ORDER.indexOf(phase);
}

export function hasWoken(state: QuietInterfaceState): boolean {
  return state.progress.kind !== "dormant";
}

export function hasReadCarrier(state: QuietInterfaceState): boolean {
  return state.progress.kind === "observing"
    ? state.progress.observation.carrierRead
    : progressAtLeast(state.progress, "decoding");
}

export function hasReadTrace(state: QuietInterfaceState): boolean {
  return state.progress.kind === "observing"
    ? state.progress.observation.traceRead
    : progressAtLeast(state.progress, "decoding");
}

export function hasDecodedSignal(state: QuietInterfaceState): boolean {
  return progressAtLeast(state.progress, "signal-locked");
}

export function hasBuiltImage(state: QuietInterfaceState): boolean {
  return progressAtLeast(state.progress, "image-built");
}

export function hasVerifiedImage(state: QuietInterfaceState): boolean {
  return progressAtLeast(state.progress, "image-verified");
}

export function hasMountedBoundary(state: QuietInterfaceState): boolean {
  return progressAtLeast(state.progress, "mounted");
}

export function isBoundaryAttached(state: QuietInterfaceState): boolean {
  return state.progress.kind === "mounted" || state.progress.kind === "inside";
}

export function hasEnteredBoundary(state: QuietInterfaceState): boolean {
  return progressAtLeast(state.progress, "inside");
}

export function hasReleased(state: QuietInterfaceState): boolean {
  return state.progress.kind === "outside";
}

export function signalLevelForState(state: QuietInterfaceState): number {
  const levels: Record<InterfacePhase, number> = {
    dormant: 0,
    observing: hasReadCarrier(state) || hasReadTrace(state) ? 26 : 10,
    decoding: 46,
    "signal-locked": 60,
    "image-built": 70,
    "image-verified": 78,
    mounted: 88,
    inside: 94,
    outside: 100
  };
  return levels[state.progress.kind];
}

export function recordHintUsed(state: QuietInterfaceState, hintId: string): QuietInterfaceState {
  if (state.metrics.hintsUsed.includes(hintId)) {
    return state;
  }

  return {
    ...state,
    metrics: {
      ...state.metrics,
      hintsUsed: [...state.metrics.hintsUsed, hintId]
    }
  };
}

export function introLines(state: QuietInterfaceState): TerminalLine[] {
  if (state.progress.kind === "outside") {
    return [
      { text: "outside namespace restored", tone: "accent" },
      { text: "operator recognized", tone: "muted" },
      { text: "" }
    ];
  }

  if (state.progress.kind !== "dormant") {
    return [
      { text: "local session restored", tone: "accent" },
      { text: `stage: ${state.progress.kind}`, tone: "muted" },
      { text: `cwd: ${state.cwd}`, tone: "muted" },
      { text: "" }
    ];
  }

  return [
    { text: "mount: /surface [ro]", tone: "muted" },
    { text: "interface.service: inactive", tone: "muted" },
    { text: "stdin: operator channel" },
    { text: "" }
  ];
}
