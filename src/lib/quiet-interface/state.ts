export type InterfacePhase = "dormant" | "observation" | "assembly" | "boundary" | "inside" | "outside";

export type VisualEvent =
  | "wake"
  | "listen"
  | "scan"
  | "trace"
  | "align"
  | "align-correct"
  | "align-wrong"
  | "make-signal"
  | "boundary"
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
};

export type QuietInterfaceState = {
  phase: InterfacePhase;
  signalLevel: number;
  hasWoken: boolean;
  hasListened: boolean;
  hasTraced: boolean;
  hasScanned: boolean;
  hasAligned: boolean;
  signalToken: string;
  signalSlots: string[];
  traceOrder: number[];
  hasDecodedSignal: boolean;
  alignAttempts: number;
  usedReadHint: boolean;
  perfectRunEligible: boolean;
  hasMadeSignal: boolean;
  boundaryVisible: boolean;
  boundaryOpen: boolean;
  hasEntered: boolean;
  hasReleased: boolean;
  commandHistory: string[];
  discoveredCommands: string[];
  operatorEchoes: string[];
  lastVisualEvent?: VisualEvent;
};

export type CommandResult = {
  nextState: QuietInterfaceState;
  output: TerminalLine[];
  visualEvent?: VisualEvent;
  error?: boolean;
};

export const INITIAL_DISCOVERED_COMMANDS = [
  "help",
  "pwd",
  "ls",
  "find",
  "file",
  "cat",
  "strings",
  "grep",
  "systemctl start interface",
  "clear",
  "reset"
] as const;

export function createInitialState(overrides: Partial<QuietInterfaceState> = {}): QuietInterfaceState {
  return {
    phase: "dormant",
    signalLevel: 0,
    hasWoken: false,
    hasListened: false,
    hasTraced: false,
    hasScanned: false,
    hasAligned: false,
    signalToken: "lumen",
    signalSlots: ["N", "M", "L", "E", "U"],
    traceOrder: [3, 5, 2, 4, 1],
    hasDecodedSignal: false,
    alignAttempts: 0,
    usedReadHint: false,
    perfectRunEligible: true,
    hasMadeSignal: false,
    boundaryVisible: false,
    boundaryOpen: false,
    hasEntered: false,
    hasReleased: false,
    commandHistory: [],
    discoveredCommands: [...INITIAL_DISCOVERED_COMMANDS],
    operatorEchoes: [],
    ...overrides
  };
}

export function createReleasedState(): QuietInterfaceState {
  return createInitialState({
    phase: "outside",
    signalLevel: 100,
    hasWoken: true,
    hasListened: true,
    hasTraced: true,
    hasScanned: true,
    hasAligned: true,
    hasDecodedSignal: true,
    alignAttempts: 1,
    perfectRunEligible: false,
    hasMadeSignal: true,
    boundaryVisible: true,
    boundaryOpen: true,
    hasEntered: true,
    hasReleased: true,
    discoveredCommands: [
      "help",
      "pwd",
      "ls",
      "find",
      "file",
      "cat",
      "strings",
      "grep",
      "listen",
      "scan",
      "trace",
      "echo",
      "printf",
      "make signal",
      "cd",
      "./release",
      "contact",
      "whois",
      "outside",
      "clear",
      "reset"
    ],
    lastVisualEvent: "release"
  });
}

export function addDiscoveredCommands(state: QuietInterfaceState, commands: string[]): string[] {
  return Array.from(new Set([...state.discoveredCommands, ...commands]));
}

export function introLines(state: QuietInterfaceState): TerminalLine[] {
  if (state.hasReleased) {
    return [
      { text: "SYSTEM INTERFACE", tone: "muted" },
      { text: "state: outside", tone: "accent" },
      { text: "operator recognized", tone: "muted" },
      { text: "" }
    ];
  }

  return [
    { text: "SYSTEM INTERFACE", tone: "muted" },
    { text: "state: dormant", tone: "muted" },
    { text: "operator input required", tone: "muted" },
    { text: "" }
  ];
}
