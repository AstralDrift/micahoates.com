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
  const dormantReadableCommands = new Set([
    "help",
    "man",
    "pwd",
    "ls",
    "tree",
    "find",
    "file",
    "cat",
    "strings",
    "grep",
    "systemctl start interface",
    "reset",
    "clear"
  ]);

  if (
    state.hasWoken ||
    command === "wake" ||
    dormantReadableCommands.has(command) ||
    HIDDEN_RESPONSES[command] ||
    OUTSIDE_COMMANDS.includes(command)
  ) {
    return null;
  }

  return {
    nextState: applyEvent(state, "error", {}),
    output: output(["interface dormant", "try: systemctl start interface"]),
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

function carrierSample(state: QuietInterfaceState) {
  return state.signalSlots.map((slot, index) => `${index + 1}:${slot}`).join("  ");
}

function traceOrder(state: QuietInterfaceState) {
  return state.traceOrder.join(" -> ");
}

function normalizePath(path: string) {
  return path
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^\.?\//, "")
    .replace(/^proc\//, "")
    .replace(/^surface\//, "")
    .replace(/^mnt\/surface\//, "");
}

export function currentPath(state: QuietInterfaceState) {
  if (state.phase === "outside") return "/outside";
  if (state.phase === "inside") return "/surface/boundary/inside";
  if (state.phase === "boundary") return "/surface/boundary";
  return state.hasWoken ? "/surface" : "/";
}

export function visibleFiles(state: QuietInterfaceState) {
  const files = new Set([".", "README", "status"]);

  if (state.hasWoken) {
    files.add("carrier");
    files.add("carrier.sample");
    files.add("trace");
    files.add("trace.path");
    files.add("operator.log");
  }

  if (state.hasListened && state.hasTraced) {
    files.add("fragment");
    files.add("signal");
  }

  if (state.boundaryVisible) {
    files.add("boundary/");
  }

  if (state.boundaryOpen) {
    files.add("inside/");
  }

  if (state.hasEntered) {
    files.add("release*");
  }

  if (state.phase === "outside" || state.hasReleased) {
    files.add("outside");
    files.add("contact");
  }

  return Array.from(files);
}

export function shellPrompt(state: QuietInterfaceState) {
  return `operator:${currentPath(state)}$`;
}

export function pathSuggestions(state: QuietInterfaceState) {
  return visibleFiles(state)
    .map((file) => file.replace(/[*]$/, ""))
    .flatMap((file) => (file.endsWith("/") ? [file, file.slice(0, -1)] : [file]));
}

function fileRows(state: QuietInterfaceState) {
  return visibleFiles(state).map((name) => {
    const directory = name.endsWith("/");
    const executable = name.endsWith("*");
    const plainName = name.replace(/[*]$/, "");
    return {
      name,
      mode: directory ? "dr-xr-xr-x" : executable ? "-r-xr-xr-x" : "-r--r--r--",
      size: directory ? 96 : plainName === "carrier.sample" || plainName === "trace.path" ? 64 : plainName === "signal" ? 5 : 32
    };
  });
}

function listLines(state: QuietInterfaceState, args: string) {
  const long = /\B-l|(^|\s)-[a-z]*l[a-z]*(\s|$)/.test(args);
  const all = /\B-a|(^|\s)-[a-z]*a[a-z]*(\s|$)/.test(args);
  const rows = fileRows(state).filter((row) => all || !row.name.startsWith("."));

  if (!long) {
    return output(rows.map((row) => row.name));
  }

  return output([
    `total ${rows.length}`,
    ...rows.map((row) => `${row.mode} 1 operator surface ${String(row.size).padStart(5, " ")} Jun 20 00:00 ${row.name}`)
  ]);
}

function treeLines(state: QuietInterfaceState) {
  const lines = ["."];

  const rootFiles = ["README", "status"];
  if (state.hasWoken) {
    rootFiles.push("carrier.sample", "trace.path", "operator.log");
  }
  if (state.hasListened && state.hasTraced) {
    rootFiles.push("fragment", "signal");
  }

  rootFiles.forEach((file, index) => {
    const last = index === rootFiles.length - 1 && !state.boundaryVisible && !state.hasReleased;
    lines.push(`${last ? "`" : "|"}-- ${file}`);
  });

  if (state.boundaryVisible) {
    lines.push(`${state.hasReleased ? "|" : "`"}-- boundary/`);
    lines.push(`    ${state.boundaryOpen ? "|-- inside/" : "`-- closed"}`);
    if (state.hasEntered) {
      lines.push("    `-- inside/release*");
    }
  }

  if (state.hasReleased) {
    lines.push("`-- outside/");
    lines.push("    |-- contact");
    lines.push("    `-- record");
  }

  return output(lines);
}

function manLines(topic: string) {
  const command = topic.trim() || "help";
  const notes: Record<string, string[]> = {
    help: ["help", "  list commands currently visible to this phase"],
    ls: ["ls [-la]", "  list files exposed by the current surface"],
    tree: ["tree", "  print the recovered filesystem shape"],
    find: ["find [path]", "  walk visible files; options are tolerated, not required"],
    file: ["file <path>", "  identify a file before reading it"],
    cat: ["cat <path>", "  read virtual files; carrier and trace mutate the apparatus"],
    strings: ["strings carrier.sample", "  extract readable carrier bytes"],
    grep: ["grep <pattern> <file>", "  search carrier, trace, status, or fragment"],
    echo: ["echo <token> > signal", "  write a decoded token into the signal sink"],
    printf: ["printf <token> > signal", "  write a decoded token without echo text"],
    make: ["make signal", "  assemble the boundary after signal is decoded"],
    cd: ["cd boundary", "cd inside", "  move through located surfaces"],
    "./release": ["./release", "  execute the outside transition from inside"]
  };

  const lines = notes[command] ?? notes[command.split(" ")[0] ?? ""] ?? [`${command}: no manual entry`];
  return output([{ text: `MAN ${command}`, tone: "accent" }, ...lines]);
}

function statusLines(state: QuietInterfaceState) {
  return output([
    { text: "system state:", tone: "accent" },
    `  phase: ${state.phase}`,
    `  path: ${currentPath(state)}`,
    `  signal: ${state.signalLevel}%`,
    `  carrier: ${state.hasListened ? "detected" : "silent"}`,
    `  alignment: ${state.hasDecodedSignal ? "decoded" : "unresolved"}`,
    `  boundary: ${state.boundaryOpen ? "open" : state.boundaryVisible ? "located" : "not visible"}`
  ]);
}

function lookLines(state: QuietInterfaceState) {
  return output([
    state.hasEntered ? "you are inside a reduced surface" : "you are viewing a quiet interface",
    "no windows",
    "no pointer path",
    "no declared purpose",
    "",
    state.hasWoken ? "the system is listening for commands" : "the surface is dormant"
  ]);
}

function fileLines(state: QuietInterfaceState, rawPath: string) {
  const path = normalizePath(rawPath);
  const kind = (() => {
    switch (path) {
      case "":
        return "missing operand";
      case "readme":
      case "README":
        return "ASCII text";
      case "status":
      case "interface/status":
        return "virtual status file";
      case "carrier":
      case "carrier.sample":
        return state.hasWoken ? "carrier sample, scrambled five-slot signal" : "carrier sample, device asleep";
      case "trace":
      case "trace.path":
        return state.hasWoken ? "route order, ascii text" : "trace path, device asleep";
      case "fragment":
        return state.hasListened && state.hasTraced ? "recovered text fragment" : "fragment, unresolved";
      case "signal":
        return state.hasDecodedSignal ? "signal token, locked" : "signal token, writable";
      case "boundary":
      case "boundary/":
        return state.boundaryVisible ? "directory" : "cannot open: no such file";
      case "inside":
      case "inside/":
        return state.boundaryOpen ? "directory" : "cannot open: no such file";
      case "release":
      case "release*":
        return state.hasEntered ? "executable" : "cannot open: no such file";
      case "outside":
      case "contact":
        return state.hasReleased ? "outside record" : "cannot open: permission denied";
      default:
        return "cannot open: no such file";
    }
  })();

  return output([path ? `${rawPath}: ${kind}` : "file: missing operand"]);
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

    case "man":
      return {
        nextState: state,
        output: manLines(parsed.args)
      };

    case "pwd":
      return {
        nextState: state,
        output: output([currentPath(state)])
      };

    case "ls": {
      const nextState = state.hasWoken
        ? applyEvent(state, "scan", {
            hasScanned: true,
            signalLevel: Math.max(state.signalLevel, 30)
          })
        : state;

      return {
        nextState,
        output: listLines(nextState, parsed.args),
        visualEvent: state.hasWoken ? "scan" : undefined
      };
    }

    case "tree": {
      const nextState = state.hasWoken
        ? applyEvent(state, "scan", {
            hasScanned: true,
            signalLevel: Math.max(state.signalLevel, 30)
          })
        : state;

      return {
        nextState,
        output: treeLines(nextState),
        visualEvent: state.hasWoken ? "scan" : undefined
      };
    }

    case "find": {
      const nextState = state.hasWoken
        ? applyEvent(state, "scan", {
            hasScanned: true,
            signalLevel: Math.max(state.signalLevel, 30)
          })
        : state;

      return {
        nextState,
        output: output(visibleFiles(nextState).map((file) => (file === "." ? "." : `./${file}`))),
        visualEvent: state.hasWoken ? "scan" : undefined
      };
    }

    case "file":
      return {
        nextState: state,
        output: fileLines(state, parsed.args)
      };

    case "cat": {
      const path = normalizePath(parsed.args);

      if (!path) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["cat: missing operand"]),
          visualEvent: "error",
          error: true
        };
      }

      if (path === "readme") {
        return {
          nextState: state,
          output: lookLines(state)
        };
      }

      if (path === "status" || path === "interface/status") {
        return {
          nextState: state,
          output: statusLines(state)
        };
      }

      if (path === "operator.log") {
        return {
          nextState: state,
          output: output([
            "operator.log:",
            "  input: keyboard",
            `  cwd: ${currentPath(state)}`,
            `  carrier: ${state.hasListened ? "sampled" : "unread"}`,
            `  trace: ${state.hasTraced ? "read" : "unread"}`,
            `  signal: ${state.hasDecodedSignal ? "locked" : "empty"}`
          ])
        };
      }

      if (path === "signal") {
        return {
          nextState: state,
          output: state.hasDecodedSignal ? output([state.signalToken]) : output(["cat: signal: input/output error"])
        };
      }

      if (path === "carrier" || path === "carrier.sample") {
        if (!state.hasWoken) {
          return {
            nextState: applyEvent(state, "error", {}),
            output: output(["cat: carrier: device asleep", "try: systemctl start interface"]),
            visualEvent: "error",
            error: true
          };
        }
        return runQuietCommand("listen", state);
      }

      if (path === "trace" || path === "trace.path") {
        if (!state.hasWoken) {
          return {
            nextState: applyEvent(state, "error", {}),
            output: output(["cat: trace: device asleep", "try: systemctl start interface"]),
            visualEvent: "error",
            error: true
          };
        }
        return runQuietCommand("trace", state);
      }

      if (path === "fragment") {
        return runQuietCommand("read", state);
      }

      if (path === "boundary") {
        return {
          nextState: state,
          output: state.boundaryVisible
            ? output(["boundary/", state.boundaryOpen ? "  inside/" : "  closed"])
            : output(["cat: boundary: no such file"])
        };
      }

      if (path === "outside") {
        return runQuietCommand("outside", state);
      }

      if (path === "contact") {
        return runQuietCommand("contact", state);
      }

      return {
        nextState: applyEvent(state, "error", {}),
        output: output([`cat: ${parsed.args}: no such file`]),
        visualEvent: "error",
        error: true
      };
    }

    case "strings": {
      const path = normalizePath(parsed.args);
      if (path !== "carrier" && path !== "carrier.sample") {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([path ? `strings: ${parsed.args}: no readable strings` : "strings: missing operand"]),
          visualEvent: "error",
          error: true
        };
      }

      if (!state.hasWoken) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["strings: carrier: device asleep", "try: systemctl start interface"]),
          visualEvent: "error",
          error: true
        };
      }

      return runQuietCommand("listen", state);
    }

    case "grep": {
      const args = parsed.args.split(" ").filter(Boolean);
      const filteredArgs = args.filter((arg) => !arg.startsWith("-"));
      const [pattern = "", rawPath = ""] = filteredArgs;
      const path = normalizePath(rawPath);

      if (!pattern || !path) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["grep: usage: grep <pattern> <file>"]),
          visualEvent: "error",
          error: true
        };
      }

      const searchable = (() => {
        if (path === "carrier" || path === "carrier.sample") return `sample: ${carrierSample(state)}`;
        if (path === "trace" || path === "trace.path") return `route: ${traceOrder(state)}`;
        if (path === "status") return statusLines(state).map((line) => line.text).join("\n");
        if (path === "operator.log") return `cwd: ${currentPath(state)}\ncarrier: ${state.hasListened ? "sampled" : "unread"}\ntrace: ${state.hasTraced ? "read" : "unread"}`;
        if (path === "signal" && state.hasDecodedSignal) return state.signalToken;
        if (path === "fragment" && state.hasListened && state.hasTraced) return "follow trace order across carrier sample";
        return "";
      })();

      if (!searchable) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([`grep: ${rawPath}: no such file`]),
          visualEvent: "error",
          error: true
        };
      }

      return {
        nextState: state,
        output: searchable.toLowerCase().includes(pattern.toLowerCase()) ? output(searchable.split("\n")) : []
      };
    }

    case "systemctl start interface":
    case "wake": {
      if (state.hasWoken) {
        return {
          nextState: state,
          output: output(["interface already awake", "try: cat carrier"])
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
          { text: "new file available: carrier", tone: "accent" }
        ]),
        visualEvent: "wake"
      };
    }

    case "look":
      return {
        nextState: state,
        output: lookLines(state)
      };

    case "status":
      return {
        nextState: state,
        output: statusLines(state)
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
          `sample: ${carrierSample(state)}`,
          "pattern incomplete",
          "background process declined to identify itself",
          "",
          { text: `new file available: ${readyForAssembly ? "signal" : "trace"}`, tone: "accent" }
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
          `route: ${traceOrder(state)}`,
          "signal path found behind visible surface",
          "coherence increased",
          "",
          { text: `new write target available: ${readyForAssembly ? "signal" : "carrier"}`, tone: "accent" }
        ]),
        visualEvent: "trace"
      };
    }

    case "echo": {
      const redirect = parsed.args.match(/^(.+?)\s*>\s*(?:\.?\/)?(?:proc\/)?signal$/);
      if (redirect) {
        return runQuietCommand(`align ${redirect[1]?.trim() ?? ""}`, state);
      }

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

    case "printf": {
      const redirect = parsed.args.match(/^(.+?)\s*>\s*(?:\.?\/)?(?:proc\/)?signal$/);
      if (!redirect) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["printf: usage: printf <token> > signal"]),
          visualEvent: "error",
          error: true
        };
      }

      return runQuietCommand(`align ${redirect[1]?.trim() ?? ""}`, state);
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
          nextState: applyEvent(state, "error", {
            perfectRunEligible: false
          }),
          output: output(["alignment failed", "required: cat carrier + cat trace"]),
          visualEvent: "error",
          error: true
        };
      }

      if (!parsed.args) {
        return {
          nextState: applyEvent(state, "align-wrong", {
            perfectRunEligible: false
          }),
          output: output(["token required", "try: echo <token> > signal"]),
          visualEvent: "align-wrong",
          error: true
        };
      }

      if (parsed.args !== state.signalToken) {
        return {
          nextState: applyEvent(state, "align-wrong", {
            alignAttempts: state.alignAttempts + 1,
            perfectRunEligible: false
          }),
          output: output([
            { text: "alignment rejected", tone: "warning" },
            `attempts: ${state.alignAttempts + 1}`
          ]),
          visualEvent: "align-wrong",
          error: true
        };
      }

      return {
        nextState: applyEvent(state, "align-correct", {
          hasAligned: true,
          hasDecodedSignal: true,
          alignAttempts: state.alignAttempts + 1,
          signalLevel: Math.max(state.signalLevel, 58),
          perfectRunEligible: state.perfectRunEligible && state.alignAttempts === 0 && !state.usedReadHint
        }),
        output: output([
          "signal decoded",
          "visible fragments aligned",
          "",
          { text: "new make target available: signal", tone: "accent" }
        ]),
        visualEvent: "align-correct"
      };

    case "make signal":
      if (!state.hasListened || !state.hasTraced || !state.hasDecodedSignal) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["carrier fragments incomplete", "required: echo <token> > signal"]),
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
          { text: "new directory available: boundary", tone: "accent" }
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
          "  cd inside"
        ]),
        visualEvent: "boundary"
      };

    case "cd": {
      const path = normalizePath(parsed.args || ".");

      if (path === "." || path === "") {
        return {
          nextState: state,
          output: output([currentPath(state)])
        };
      }

      if (path === "boundary") {
        return runQuietCommand("open boundary", state);
      }

      if (path === "inside" || path === "boundary/inside") {
        return runQuietCommand("enter", state);
      }

      if (path === "outside") {
        return runQuietCommand("outside", state);
      }

      return {
        nextState: applyEvent(state, "error", {}),
        output: output([`cd: ${parsed.args}: no such directory`]),
        visualEvent: "error",
        error: true
      };
    }

    case "read":
      if (state.hasListened && state.hasTraced && !state.hasDecodedSignal) {
        return {
          nextState: applyEvent(state, "hint", {
            usedReadHint: true,
            perfectRunEligible: false
          }),
          output: output([
            "fragment:",
            "  follow trace order across carrier sample"
          ]),
          visualEvent: "hint"
        };
      }

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
          output: output(["entry refused", "required: cd boundary"]),
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
        output: output(["inside surface reached", "visible systems reduced", "outside channel detected", "", { text: "executable available: ./release", tone: "accent" }]),
        visualEvent: "enter"
      };

    case "./release":
    case "release":
      if (!state.hasEntered) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["release has no surface here", "required: cd inside"]),
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
        output: releaseLines(state.perfectRunEligible),
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

    case "history":
      return {
        nextState: state,
        output:
          state.commandHistory.length > 0
            ? output(state.commandHistory.map((historyCommand, index) => `${String(index + 1).padStart(4, " ")}  ${historyCommand}`))
            : output(["history: empty"])
      };

    case "contact":
    case "whois":
    case "outside":
      if (!state.hasReleased && state.phase !== "outside") {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output(["outside channel unavailable", "required: ./release"]),
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
