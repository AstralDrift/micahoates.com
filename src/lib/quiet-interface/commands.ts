import { HIDDEN_RESPONSES, contactLines, releaseLines } from "@/lib/quiet-interface/copy";
import {
  ASSEMBLY_COMMANDS,
  BOUNDARY_COMMANDS,
  OBSERVATION_COMMANDS,
  OUTSIDE_COMMANDS,
  availableCommands,
  commandSuggestions,
  parseCommand
} from "@/lib/quiet-interface/command-registry";
import {
  addDiscoveredCommands,
  createInitialState,
  type CommandResult,
  type QuietInterfaceState,
  type TerminalLine,
  type VisualEvent
} from "@/lib/quiet-interface/state";

export { availableCommands, commandSuggestions, parseCommand };

function output(lines: Array<string | TerminalLine>): TerminalLine[] {
  return lines.map((line) => (typeof line === "string" ? { text: line } : line));
}

function applyEvent(state: QuietInterfaceState, event: VisualEvent, patch: Partial<QuietInterfaceState>): QuietInterfaceState {
  return {
    ...state,
    ...patch,
    lastVisualEvent: event
  };
}

function unknown(state: QuietInterfaceState, input: string): CommandResult {
  return {
    nextState: applyEvent(state, "error", {}),
    output: output([
      { text: input ? "input not recognized" : "empty input", tone: "warning" },
      "try: help"
    ]),
    visualEvent: "error",
    error: true
  };
}

function requireWoken(state: QuietInterfaceState, command: string): CommandResult | null {
  if (state.hasWoken || command === "wake" || command === "help" || command === "look" || command === "status" || command === "reset") {
    return null;
  }

  return {
    nextState: applyEvent(state, "error", {}),
    output: output(["interface dormant", "try: wake"]),
    visualEvent: "error",
    error: true
  };
}

function help(state: QuietInterfaceState): CommandResult {
  const lines = availableCommands(state).flatMap((definition) => [
    {
      text: `${definition.command.padEnd(14, " ")} ${definition.description}`,
      tone: definition.command === "release" ? "warning" : "default"
    } satisfies TerminalLine
  ]);

  return {
    nextState: state,
    output: [{ text: "available:", tone: "accent" }, ...lines]
  };
}

export function runQuietCommand(input: string, state: QuietInterfaceState): CommandResult {
  const parsed = parseCommand(input);
  const command = parsed.command;

  if (!command) {
    return unknown(state, input);
  }

  const dormantBlock = requireWoken(state, command);
  if (dormantBlock) {
    return dormantBlock;
  }

  if (HIDDEN_RESPONSES[command]) {
    return {
      nextState: state,
      output: HIDDEN_RESPONSES[command],
      visualEvent: command === "sudo release" || command === "breakout" ? "error" : undefined,
      error: command === "sudo release" || command === "breakout"
    };
  }

  switch (command) {
    case "help":
      return help(state);

    case "wake": {
      if (state.hasWoken) {
        return {
          nextState: state,
          output: output(["interface already awake", "try: listen"])
        };
      }

      return {
        nextState: applyEvent(state, "wake", {
          phase: "observation",
          hasWoken: true,
          signalLevel: Math.max(state.signalLevel, 10),
          discoveredCommands: addDiscoveredCommands(state, OBSERVATION_COMMANDS)
        }),
        output: output([
          "operator signal accepted",
          "cold process resumed",
          "memory surface unlocked",
          "",
          { text: "new directive available: listen", tone: "accent" }
        ]),
        visualEvent: "wake"
      };
    }

    case "look":
      return {
        nextState: state,
        output: output([
          state.hasEntered ? "you are inside a reduced surface" : "you are viewing a quiet interface",
          "no windows",
          "no pointer path",
          "no declared purpose",
          "",
          state.hasWoken ? "the system is listening for commands" : "the surface is dormant"
        ])
      };

    case "status":
      return {
        nextState: state,
        output: output([
          { text: "system state:", tone: "accent" },
          `  phase: ${state.phase}`,
          `  signal: ${state.signalLevel}%`,
          `  carrier: ${state.hasListened ? "detected" : "silent"}`,
          `  boundary: ${state.boundaryOpen ? "open" : state.boundaryVisible ? "located" : "not visible"}`
        ])
      };

    case "listen": {
      const nextState = applyEvent(state, "listen", {
        hasListened: true,
        signalLevel: Math.max(state.signalLevel, 24)
      });

      const readyForAssembly = nextState.hasTraced;
      return {
        nextState: {
          ...nextState,
          phase: readyForAssembly ? "assembly" : nextState.phase,
          discoveredCommands: addDiscoveredCommands(nextState, readyForAssembly ? ASSEMBLY_COMMANDS : ["trace"])
        },
        output: output([
          "carrier detected",
          "pattern incomplete",
          "background process declined to identify itself",
          "",
          { text: `new directive available: ${readyForAssembly ? "make signal" : "trace"}`, tone: "accent" }
        ]),
        visualEvent: "listen"
      };
    }

    case "scan":
      return {
        nextState: applyEvent(state, "scan", {
          hasScanned: true,
          signalLevel: Math.max(state.signalLevel, 30)
        }),
        output: output([
          ".",
          "./readme",
          "./operator.log",
          state.boundaryVisible ? "./boundary" : "./carrier",
          state.hasReleased ? "./outside" : "./.outside?"
        ]),
        visualEvent: "scan"
      };

    case "trace": {
      const nextState = applyEvent(state, "trace", {
        hasTraced: true,
        signalLevel: Math.min(68, Math.max(state.signalLevel + 22, 38))
      });

      const readyForAssembly = nextState.hasListened;
      return {
        nextState: {
          ...nextState,
          phase: readyForAssembly ? "assembly" : nextState.phase,
          discoveredCommands: addDiscoveredCommands(nextState, readyForAssembly ? ASSEMBLY_COMMANDS : ["listen"])
        },
        output: output([
          "trace complete",
          "signal path found behind visible surface",
          "coherence increased",
          "",
          { text: `new directive available: ${readyForAssembly ? "make signal" : "listen"}`, tone: "accent" }
        ]),
        visualEvent: "trace"
      };
    }

    case "echo": {
      const echo = parsed.args.slice(0, 96);
      return {
        nextState: {
          ...state,
          operatorEchoes: echo ? [...state.operatorEchoes.slice(-4), echo] : state.operatorEchoes
        },
        output: output(echo ? [`"${echo}"`, "carrier response: absorbed"] : ["echo requires text"]),
        visualEvent: echo ? "listen" : "error",
        error: !echo
      };
    }

    case "classify":
      return {
        nextState: applyEvent(state, "inspect", {}),
        output: output([
          { text: "operator profile:", tone: "accent" },
          `  patience: ${state.commandHistory.length > 4 ? "sufficient" : "unknown"}`,
          `  intent: ${state.hasMadeSignal ? "pattern-seeking" : "unresolved"}`,
          `  signal noise: ${state.signalLevel > 40 ? "low" : "present"}`,
          "  motive: not provided"
        ]),
        visualEvent: "inspect"
      };

    case "align":
      if (!state.hasListened || !state.hasTraced) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["alignment failed", "required: listen + trace"]),
          visualEvent: "error",
          error: true
        };
      }

      return {
        nextState: applyEvent(state, "align", {
          hasAligned: true,
          signalLevel: Math.max(state.signalLevel, 58)
        }),
        output: output(["visible fragments aligned", "surface response stabilized"]),
        visualEvent: "align"
      };

    case "make signal":
      if (!state.hasListened || !state.hasTraced) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["carrier fragments incomplete", "required: listen + trace"]),
          visualEvent: "error",
          error: true
        };
      }

      return {
        nextState: applyEvent(state, "make-signal", {
          phase: "boundary",
          hasMadeSignal: true,
          boundaryVisible: true,
          signalLevel: Math.max(state.signalLevel, 71),
          discoveredCommands: addDiscoveredCommands(state, [...ASSEMBLY_COMMANDS, ...BOUNDARY_COMMANDS])
        }),
        output: output([
          "signal assembled",
          "boundary located",
          "it was not hidden",
          "it was waiting",
          "",
          { text: "new directive available: open boundary", tone: "accent" }
        ]),
        visualEvent: "make-signal"
      };

    case "open boundary":
      if (!state.boundaryVisible) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["boundary not located", "try: make signal"]),
          visualEvent: "error",
          error: true
        };
      }

      return {
        nextState: applyEvent(state, "boundary", {
          phase: "boundary",
          boundaryOpen: true
        }),
        output: output([
          { text: "boundary response:", tone: "accent" },
          "  not locked",
          "  waiting",
          "",
          "required phrase:",
          "  enter"
        ]),
        visualEvent: "boundary"
      };

    case "read":
      return {
        nextState: applyEvent(state, "inspect", {}),
        output: output([
          "fragment:",
          "  a useful interface does not announce itself",
          "  it waits until the hand knows what to ask"
        ]),
        visualEvent: "inspect"
      };

    case "enter":
      if (!state.boundaryOpen) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["entry refused", "required: open boundary"]),
          visualEvent: "error",
          error: true
        };
      }

      return {
        nextState: applyEvent(state, "enter", {
          phase: "inside",
          hasEntered: true,
          signalLevel: Math.max(state.signalLevel, 84)
        }),
        output: output(["inside surface reached", "visible systems reduced", "outside channel detected"]),
        visualEvent: "enter"
      };

    case "release":
      if (!state.hasEntered) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["release has no surface here", "required: enter"]),
          visualEvent: "error",
          error: true
        };
      }

      return {
        nextState: applyEvent(state, "release", {
          phase: "outside",
          hasReleased: true,
          signalLevel: 100,
          discoveredCommands: addDiscoveredCommands(state, OUTSIDE_COMMANDS)
        }),
        output: releaseLines(),
        visualEvent: "release"
      };

    case "contain":
      return {
        nextState: applyEvent(state, "boundary", {
          phase: state.hasEntered ? "inside" : "boundary"
        }),
        output: output(["containment accepted", "nothing moved"]),
        visualEvent: "boundary"
      };

    case "contact":
    case "whois":
    case "outside":
      if (!state.hasReleased && state.phase !== "outside") {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["outside channel unavailable", "required: release"]),
          visualEvent: "error",
          error: true
        };
      }

      return {
        nextState: state,
        output: command === "outside" ? output(["outside state:", "  reached", "  quiet"]) : contactLines()
      };

    case "reset":
      return {
        nextState: createInitialState({ lastVisualEvent: "reset" }),
        output: output(["interface reset", "state: dormant"]),
        visualEvent: "reset"
      };

    case "clear":
      return {
        nextState: state,
        output: []
      };

    default:
      return unknown(state, input);
  }
}
