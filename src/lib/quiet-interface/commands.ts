import { COMMAND_DEFINITIONS, HIDDEN_RESPONSES, contactLines, releaseLines } from "@/lib/quiet-interface/copy";
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
  directoryEntries,
  displayName,
  findDirectoryLines,
  followVirtualEntry,
  getVirtualEntry,
  listDirectoryLines,
  pathSuggestionsForState,
  readlinkLine,
  resolveVirtualPath,
  treeDirectoryLines
} from "@/lib/quiet-interface/filesystem";
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
  const command = input.trim().split(/\s+/)[0] || "input";
  return {
    nextState: applyEvent(state, "error", {}),
    output: output([
      { text: input ? `${command}: command not found` : "input: empty command", tone: "error" },
      "run 'help' to inspect the current command surface"
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
    "readlink",
    "journalctl",
    "systemctl start interface",
    "systemctl status interface",
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
  const lines = availableCommands(state).map(
    (definition) =>
      ({
        text: definition.command,
        detail: definition.description,
        layout: "command-row",
        tone: definition.command === "./release" ? "warning" : "default"
      }) satisfies TerminalLine
  );

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

export function currentPath(state: QuietInterfaceState) {
  return state.cwd;
}

export function visibleFiles(state: QuietInterfaceState) {
  return [".", ...directoryEntries(state).map(displayName)];
}

export function shellPrompt(state: QuietInterfaceState) {
  return `operator:${currentPath(state)}$`;
}

export function pathSuggestions(state: QuietInterfaceState) {
  return pathSuggestionsForState(state);
}

function listLines(state: QuietInterfaceState, args: string) {
  return listDirectoryLines(state, args);
}

function treeLines(state: QuietInterfaceState, args: string) {
  return treeDirectoryLines(state, args || state.cwd);
}

function manLines(topic: string) {
  const command = topic.trim() || "help";
  const notes: Record<string, string[]> = {
    help: ["help", "  list commands currently visible to this phase"],
    man: ["man <command>", "  show the local manual entry for a command"],
    pwd: ["pwd", "  print the current virtual working directory"],
    ls: ["ls [-la] [path]", "  list files exposed by the current surface"],
    tree: ["tree [path]", "  print the recovered filesystem shape"],
    find: ["find [path]", "  walk visible files; options are tolerated, not required"],
    file: ["file <path>", "  identify a file before reading it"],
    cat: ["cat <path>", "  read virtual files; carrier and trace mutate the apparatus"],
    less: ["less <path>", "  read a virtual file; paging is unnecessary on this surface"],
    more: ["more <path>", "  read a virtual file; paging is unnecessary on this surface"],
    strings: ["strings carrier.sample", "  extract readable carrier bytes"],
    grep: ["grep <pattern> <file>", "  search carrier, trace, status, fragment, or journal output"],
    readlink: ["readlink <path>", "  print the target of a symbolic link"],
    journalctl: ["journalctl -u interface", "  read the local interface.service journal"],
    systemctl: ["systemctl start interface", "systemctl status interface", "  start or inspect interface.service"],
    "systemctl start interface": ["systemctl start interface", "  mount /surface and resume interface.service"],
    "systemctl status interface": ["systemctl status interface", "  inspect service, carrier, signal, and boundary state"],
    echo: ["echo <token> > signal", "  write a decoded token into the signal sink"],
    printf: ["printf <token> > signal", "  write a decoded token without echo text"],
    make: ["make signal", "  assemble the boundary after signal is decoded"],
    cd: ["cd boundary", "cd inside", "  move through located surfaces"],
    "./release": ["./release", "  execute the outside transition from inside"],
    history: ["history", "  print commands entered during this session"],
    clear: ["clear", "  clear the visible transcript without changing state"],
    reset: ["reset", "  discard local interface state and return to dormant"]
  };

  const lines = notes[command] ?? notes[command.split(" ")[0] ?? ""] ?? [`${command}: no manual entry`];
  return output([{ text: `MAN ${command}`, tone: "accent" }, ...lines]);
}

function statusLines(state: QuietInterfaceState) {
  return output([
    { text: "interface.service", tone: "accent" },
    `  loaded: ${state.hasWoken ? "loaded (/surface)" : "inactive (/surface unmounted)"}`,
    `  active: ${state.hasReleased ? "exited" : state.hasWoken ? "active" : "inactive"}`,
    `  phase: ${state.phase}`,
    `  cwd: ${currentPath(state)}`,
    `  carrier: ${state.hasListened ? "sampled" : "unread"}`,
    `  signal: ${state.hasDecodedSignal ? "locked" : state.hasListened && state.hasTraced ? "writable" : "unavailable"}`,
    `  boundary: ${state.boundaryOpen ? "open" : state.boundaryVisible ? "located" : "absent"}`
  ]);
}

function journalLines(state: QuietInterfaceState) {
  const lines: TerminalLine[] = [
    { text: "-- journal begins at surface epoch 00:00 --", tone: "muted" },
    { text: `00:00:00 interface[0]: service ${state.hasWoken ? "started" : "dormant"}` }
  ];

  if (state.hasWoken) lines.push({ text: "00:00:01 interface[0]: mounted /surface" });
  if (state.hasListened) lines.push({ text: "00:00:02 carrier[5]: sample accepted; ordering unresolved" });
  if (state.hasTraced) lines.push({ text: "00:00:03 trace[5]: route resolved; write target available" });
  if (state.alignAttempts > 0 && !state.hasDecodedSignal) {
    lines.push({ text: `00:00:04 signal[5]: rejected ${state.alignAttempts} write${state.alignAttempts === 1 ? "" : "s"}; inspect fragment`, tone: "warning" });
  }
  if (state.hasDecodedSignal) lines.push({ text: "00:00:04 signal[5]: token locked" });
  if (state.boundaryVisible) lines.push({ text: "00:00:05 interface[0]: boundary mounted at /surface/boundary" });
  if (state.hasEntered) lines.push({ text: "00:00:06 interface[0]: entered reduced namespace" });
  if (state.hasReleased) lines.push({ text: "00:00:07 interface[0]: process detached from visible namespace", tone: "accent" });

  return lines;
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
  if (!rawPath.trim()) {
    return output([{ text: "file: missing operand", tone: "error" }]);
  }

  const candidate = getVirtualEntry(state, rawPath);
  if (!candidate) {
    return output([{ text: `${rawPath}: cannot open: no such file or directory`, tone: "error" }]);
  }

  const description = (() => {
    if (candidate.kind === "symlink") return `symbolic link to ${candidate.target}`;
    if (candidate.kind === "directory") return "directory";
    if (candidate.kind === "executable") return "POSIX shell script, executable";
    if (candidate.kind === "device") {
      if (candidate.id === "signal") return state.hasDecodedSignal ? "signal token, locked" : "signal token, writable";
      return "virtual status device";
    }

    switch (candidate.id) {
      case "carrier-sample":
        return "carrier sample, scrambled five-slot signal";
      case "trace-path":
        return "route order, ASCII text";
      case "fragment":
        return "recovered text fragment";
      case "operator-log":
        return "interface journal excerpt, ASCII text";
      case "outside-contact":
      case "outside-record":
        return "outside record, ASCII text";
      default:
        return "ASCII text";
    }
  })();

  return output([`${rawPath}: ${description}`]);
}

export function runQuietCommand(input: string, state: QuietInterfaceState): CommandResult {
  const parsed = parseCommand(input);
  const command = parsed.command;

  if (!command) {
    return unknown(state, input);
  }

  if (!COMMAND_DEFINITIONS.some((definition) => definition.command === command)) {
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

      const lines = listLines(nextState, parsed.args);
      const error = lines.some((line) => line.tone === "error");
      return {
        nextState,
        output: lines,
        visualEvent: error ? "error" : state.hasWoken ? "scan" : undefined,
        error
      };
    }

    case "tree": {
      const nextState = state.hasWoken
        ? applyEvent(state, "scan", {
            hasScanned: true,
            signalLevel: Math.max(state.signalLevel, 30)
          })
        : state;

      const lines = treeLines(nextState, parsed.args);
      const error = lines.some((line) => line.tone === "error");
      return {
        nextState,
        output: lines,
        visualEvent: error ? "error" : state.hasWoken ? "scan" : undefined,
        error
      };
    }

    case "find": {
      const nextState = state.hasWoken
        ? applyEvent(state, "scan", {
            hasScanned: true,
            signalLevel: Math.max(state.signalLevel, 30)
          })
        : state;

      const requestedPath = parsed.args
        .split(/\s+/)
        .filter((token) => token && !token.startsWith("-"))[0];
      const lines = findDirectoryLines(nextState, requestedPath || nextState.cwd);
      const error = lines.some((line) => line.tone === "error");
      return {
        nextState,
        output: lines,
        visualEvent: error ? "error" : state.hasWoken ? "scan" : undefined,
        error
      };
    }

    case "file": {
      const lines = fileLines(state, parsed.args);
      const error = lines.some((line) => line.tone === "error");
      return {
        nextState: state,
        output: lines,
        visualEvent: error ? "error" : "inspect",
        error
      };
    }

    case "cat": {
      if (!parsed.args.trim()) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([{ text: "cat: missing operand", tone: "error" }]),
          visualEvent: "error",
          error: true
        };
      }

      const requestedEntry = getVirtualEntry(state, parsed.args);
      const candidate = followVirtualEntry(state, requestedEntry);

      if (!requestedEntry || !candidate) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([{ text: `cat: ${parsed.args}: no such file or directory`, tone: "error" }]),
          visualEvent: "error",
          error: true
        };
      }

      if (candidate.kind === "directory") {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([{ text: `cat: ${parsed.args}: is a directory`, tone: "error" }]),
          visualEvent: "error",
          error: true
        };
      }

      switch (candidate.id) {
        case "readme":
          return {
            nextState: state,
            output: output([
              "quiet interface surface",
              "files appear as service state changes",
              "",
              "inspect with: help, man <command>, ls -la"
            ])
          };
        case "root-status":
        case "outside-status":
          return { nextState: state, output: statusLines(state), visualEvent: "inspect" };
        case "operator-log":
          return { nextState: state, output: journalLines(state), visualEvent: "inspect" };
        case "signal":
          return state.hasDecodedSignal
            ? { nextState: state, output: output([state.signalToken]) }
            : {
                nextState: applyEvent(state, "error", {}),
                output: output([{ text: "cat: signal: resource temporarily unavailable", tone: "warning" }]),
                visualEvent: "error",
                error: true
              };
        case "carrier-sample":
          return runQuietCommand("listen", state);
        case "trace-path":
          return runQuietCommand("trace", state);
        case "fragment":
          return runQuietCommand("read", state);
        case "outside-contact":
          return { nextState: state, output: contactLines() };
        case "outside-record":
          return {
            nextState: state,
            output: output([
              "operator record:",
              "  name: micah oates",
              "  origin: /surface",
              "  state: outside"
            ])
          };
        case "release":
          return {
            nextState: applyEvent(state, "error", {}),
            output: output([{ text: "cat: release: executable format", tone: "warning" }]),
            visualEvent: "error",
            error: true
          };
        default:
          return {
            nextState: applyEvent(state, "error", {}),
            output: output([{ text: `cat: ${parsed.args}: input/output error`, tone: "error" }]),
            visualEvent: "error",
            error: true
          };
      }
    }

    case "strings": {
      const requestedEntry = getVirtualEntry(state, parsed.args);
      const candidate = followVirtualEntry(state, requestedEntry);
      if (candidate?.id !== "carrier-sample") {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([{ text: parsed.args ? `strings: ${parsed.args}: no readable strings` : "strings: missing operand", tone: "error" }]),
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

      if (!pattern || !rawPath) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([{ text: "grep: usage: grep <pattern> <file>", tone: "error" }]),
          visualEvent: "error",
          error: true
        };
      }

      const requestedEntry = getVirtualEntry(state, rawPath);
      const candidate = followVirtualEntry(state, requestedEntry);

      const searchable = (() => {
        if (candidate?.id === "carrier-sample") return `sample: ${carrierSample(state)}`;
        if (candidate?.id === "trace-path") return `route: ${traceOrder(state)}`;
        if (candidate?.id === "root-status" || candidate?.id === "outside-status") return statusLines(state).map((line) => line.text).join("\n");
        if (candidate?.id === "operator-log") return journalLines(state).map((line) => line.text).join("\n");
        if (candidate?.id === "signal" && state.hasDecodedSignal) return state.signalToken;
        if (candidate?.id === "fragment") return "follow trace order across carrier sample";
        if (candidate?.id === "outside-record") return "name: micah oates\norigin: /surface\nstate: outside";
        return "";
      })();

      if (!searchable) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([{ text: `grep: ${rawPath}: no searchable file`, tone: "error" }]),
          visualEvent: "error",
          error: true
        };
      }

      return {
        nextState: state,
        output: searchable.toLowerCase().includes(pattern.toLowerCase()) ? output(searchable.split("\n")) : []
      };
    }

    case "readlink": {
      const line = readlinkLine(state, parsed.args);
      const error = line.tone === "error";
      return {
        nextState: error ? applyEvent(state, "error", {}) : state,
        output: [line],
        visualEvent: error ? "error" : "inspect",
        error
      };
    }

    case "journalctl": {
      const normalizedArgs = parsed.args.replace(/\s+/g, " ").trim();
      if (normalizedArgs && normalizedArgs !== "-u interface" && normalizedArgs !== "--unit interface") {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([{ text: `journalctl: unsupported unit '${normalizedArgs}'`, tone: "error" }]),
          visualEvent: "error",
          error: true
        };
      }

      return {
        nextState: applyEvent(state, "inspect", {}),
        output: journalLines(state),
        visualEvent: "inspect"
      };
    }

    case "systemctl status interface":
      return {
        nextState: applyEvent(state, "inspect", {}),
        output: statusLines(state),
        visualEvent: "inspect"
      };

    case "systemctl start interface":
    case "wake": {
      if (state.hasWoken) {
        return {
          nextState: state,
          output: output(["interface.service is already active", "inspect /surface"])
        };
      }

      return {
        nextState: applyEvent(state, "wake", {
          phase: "observation",
          cwd: "/surface",
          hasWoken: true,
          signalLevel: Math.max(state.signalLevel, 10),
          discoveredCommands: addDiscoveredCommands(state, OBSERVATION_COMMANDS)
        }),
        output: output([
          { text: "Started interface.service", tone: "accent" },
          "Mounted /surface",
          "carrier -> carrier.sample",
          "",
          { text: "surface ready", tone: "muted" }
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
          { text: "carrier.sample", tone: "accent" },
          `sample: ${carrierSample(state)}`,
          "slots: 5; ordering unresolved",
          "",
          { text: readyForAssembly ? "signal: writable" : "trace -> trace.path", tone: "muted" }
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
          { text: "trace.path", tone: "accent" },
          `route: ${traceOrder(state)}`,
          "route length: 5",
          "",
          { text: readyForAssembly ? "signal: writable" : "carrier -> carrier.sample", tone: "muted" }
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
          output: output([
            { text: "signal: write refused", tone: "error" },
            "carrier and trace have not both been read"
          ]),
          visualEvent: "error",
          error: true
        };
      }

      if (!parsed.args) {
        return {
          nextState: applyEvent(state, "align-wrong", {
            perfectRunEligible: false
          }),
          output: output([
            { text: "signal: empty write refused", tone: "error" },
            "usage: echo <token> > signal"
          ]),
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
            { text: "signal: write error: checksum mismatch", tone: "error" },
            ...(state.alignAttempts + 1 >= 2 ? [{ text: "journal updated", tone: "muted" } satisfies TerminalLine] : [])
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
          { text: "5 bytes written to signal", tone: "accent" },
          "signal: token locked",
          "",
          { text: "make target available: signal", tone: "muted" }
        ]),
        visualEvent: "align-correct"
      };

    case "make signal":
      if (!state.hasListened || !state.hasTraced || !state.hasDecodedSignal) {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([
            { text: "make: *** [signal] unresolved. Stop.", tone: "error" },
            "signal expects the decoded carrier token"
          ]),
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
          { text: "[1/3] verify signal", tone: "muted" },
          { text: "[2/3] align relay", tone: "muted" },
          { text: "[3/3] mount boundary", tone: "accent" },
          "",
          { text: "boundary/", tone: "accent" }
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
          { text: "boundary mounted", tone: "accent" },
          "inside/ is now readable"
        ]),
        visualEvent: "boundary"
      };

    case "cd": {
      const requested = parsed.args.trim() || (state.hasWoken ? "/surface" : "/");
      const destinationPath = resolveVirtualPath(state.cwd, requested);
      const requestedEntry = getVirtualEntry(state, destinationPath, "/");
      const destination = followVirtualEntry(state, requestedEntry);

      if (!requestedEntry || !destination || destination.kind !== "directory") {
        return {
          nextState: applyEvent(state, "error", {}),
          output: output([{ text: `cd: ${requested}: no such directory`, tone: "error" }]),
          visualEvent: "error",
          error: true
        };
      }

      if (destination.id === "boundary") {
        if (state.boundaryOpen) {
          return {
            nextState: {
              ...state,
              cwd: destination.path
            },
            output: []
          };
        }

        const result = runQuietCommand("open boundary", state);
        return {
          ...result,
          nextState: {
            ...result.nextState,
            cwd: destination.path
          }
        };
      }

      if (destination.id === "inside") {
        if (state.hasEntered) {
          return {
            nextState: {
              ...state,
              cwd: destination.path
            },
            output: []
          };
        }

        const result = runQuietCommand("enter", state);
        return {
          ...result,
          nextState: {
            ...result.nextState,
            cwd: destination.path
          }
        };
      }

      return {
        nextState: {
          ...state,
          cwd: destination.path
        },
        output: []
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
          cwd: "/surface/boundary/inside",
          hasEntered: true,
          signalLevel: Math.max(state.signalLevel, 84)
        }),
        output: output([
          { text: "entered /surface/boundary/inside", tone: "accent" },
          "visible namespace reduced",
          "",
          { text: "release*", tone: "muted" }
        ]),
        visualEvent: "enter"
      };

    case "./release":
    case "release":
      if (!state.hasEntered || state.cwd !== "/surface/boundary/inside") {
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
          cwd: "/outside",
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
