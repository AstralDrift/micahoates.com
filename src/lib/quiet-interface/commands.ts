import { COMMAND_DEFINITIONS, HIDDEN_RESPONSES, contactLines, releaseLines } from "@/lib/quiet-interface/copy";
import {
  OUTSIDE_COMMANDS,
  availableCommands,
  commandSuggestions,
  parseCommand
} from "@/lib/quiet-interface/command-registry";
import {
  findDirectoryLines,
  followVirtualEntry,
  getVirtualEntry,
  listDirectoryLines,
  pathSuggestionsForState,
  readlinkLine,
  resolveVirtualPath,
  treeDirectoryLines,
  type VirtualEntry
} from "@/lib/quiet-interface/filesystem";
import { PUZZLE_SPEC, type PuzzleGate } from "@/lib/quiet-interface/puzzle-spec";
import {
  createInitialState,
  hasBuiltImage,
  hasDecodedSignal,
  hasEnteredBoundary,
  hasMountedBoundary,
  hasReadCarrier,
  hasReadTrace,
  hasReleased,
  hasVerifiedImage,
  hasWoken,
  isBoundaryAttached,
  phaseForState,
  recordHintUsed,
  type CommandResult,
  type ObservationProgress,
  type PuzzleProgress,
  type QuietInterfaceState,
  type TerminalLine,
  type VisualEvent
} from "@/lib/quiet-interface/state";

export { availableCommands, commandSuggestions, parseCommand };

const OUTSIDE_COMMAND_SET = new Set<string>(OUTSIDE_COMMANDS);

function output(lines: Array<string | TerminalLine>): TerminalLine[] {
  return lines.map((line) => (typeof line === "string" ? { text: line } : line));
}

function applyEvent(state: QuietInterfaceState, event: VisualEvent): QuietInterfaceState {
  return { ...state, lastVisualEvent: event };
}

function commandResult({
  state,
  lines,
  event,
  error = false,
  transcript = "append"
}: {
  state: QuietInterfaceState;
  lines: Array<string | TerminalLine>;
  event?: VisualEvent;
  error?: boolean;
  transcript?: CommandResult["transcript"];
}): CommandResult {
  return {
    nextState: event ? applyEvent(state, event) : state,
    output: output(lines),
    visualEvent: event,
    transcript,
    error
  };
}

function incrementFailure(state: QuietInterfaceState, gate: PuzzleGate): QuietInterfaceState {
  return {
    ...state,
    metrics: {
      ...state.metrics,
      failures: {
        ...state.metrics.failures,
        [gate]: state.metrics.failures[gate] + 1
      }
    }
  };
}

function unknown(state: QuietInterfaceState, input: string): CommandResult {
  const command = input.trim().split(/\s+/)[0] || "input";
  return commandResult({
    state,
    lines: [
      { text: input ? `${command}: command not found` : "input: empty command", tone: "error" },
      "run 'help' to inspect the current command surface"
    ],
    event: "error",
    error: true
  });
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
  return commandResult({ state, lines: [{ text: "available:", tone: "accent" }, ...lines] });
}

function carrierSample(): string {
  return PUZZLE_SPEC.slots.map((slot, index) => `${index + 1}:${slot}`).join("  ");
}

function traceOrder(): string {
  return PUZZLE_SPEC.traceOrder.join(" -> ");
}

export function currentPath(state: QuietInterfaceState): string {
  return state.cwd;
}

export function shellPrompt(state: QuietInterfaceState): string {
  if (state.cwd === "/surface") return "operator:~$";
  if (state.cwd.startsWith("/surface/")) return `operator:~/${state.cwd.slice("/surface/".length)}$`;
  if (state.cwd === PUZZLE_SPEC.image.insidePath) return "operator:.../inside$";
  return `operator:${state.cwd}$`;
}

export function fullShellPrompt(state: QuietInterfaceState): string {
  return `operator:${state.cwd}$`;
}

export function pathSuggestions(state: QuietInterfaceState): string[] {
  return pathSuggestionsForState(state);
}

function manLines(topic: string): TerminalLine[] {
  const command = topic.trim() || "help";
  const notes: Record<string, string[]> = {
    help: ["help", "  list commands visible in the current stage"],
    man: ["man <command>", "  show the local manual entry for a command"],
    pwd: ["pwd", "  print the current virtual working directory"],
    ls: ["ls [-la] [path]", "  list files exposed by the current surface"],
    tree: ["tree [path]", "  print the recovered filesystem shape"],
    find: ["find [path]", "  walk visible files; options are tolerated"],
    file: ["file <path>", "  identify a file before reading it"],
    cat: ["cat <path>", "  read a virtual file"],
    less: ["less <path>", "  read a virtual file; paging is not required"],
    more: ["more <path>", "  read a virtual file; paging is not required"],
    strings: ["strings <path>", "  extract readable data from a carrier or image"],
    grep: ["grep <pattern> <file>", "  search readable virtual files"],
    readlink: ["readlink <path>", "  print the target of a symbolic link"],
    journalctl: ["journalctl -u interface", "  read the local interface.service journal"],
    systemctl: ["systemctl start interface", "systemctl status interface", "  start or inspect interface.service"],
    "systemctl start interface": ["systemctl start interface", "  mount /surface and start interface.service"],
    "systemctl status interface": ["systemctl status interface", "  inspect service, signal, image, and mount state"],
    echo: ["echo <token> > signal", "  write a decoded token into the signal sink"],
    printf: ["printf <token> > signal", "  write a decoded token without echo text"],
    make: ["make signal", "  assemble boundary.img and its checksum manifest"],
    sha256sum: ["sha256sum <file>", "sha256sum -c <manifest>", "  hash an image or verify its manifest"],
    mount: ["mount [-o ro] <image> <target>", "  attach a verified boundary image read-only"],
    cd: ["cd <directory>", "  move through visible virtual directories"],
    "./release": ["./release", "  execute the outside transition from inside"],
    xxd: ["xxd -r -p <file>", "  reverse plain hexadecimal bytes"],
    history: ["history", "  print commands entered during this session"],
    clear: ["clear", "  clear the visible transcript without changing state"],
    reset: ["reset", "  discard local interface state and return to dormant"]
  };
  const lines = notes[command] ?? notes[command.split(" ")[0] ?? ""] ?? [`${command}: no manual entry`];
  return output([{ text: `MAN ${command}`, tone: "accent" }, ...lines]);
}

function boundaryStatus(state: QuietInterfaceState): string {
  if (hasReleased(state)) return "detached";
  if (isBoundaryAttached(state)) return "mounted read-only at /mnt/boundary";
  if (hasVerifiedImage(state)) return "verified; not mounted";
  if (hasBuiltImage(state)) return "image built; unverified";
  return "absent";
}

function statusLines(state: QuietInterfaceState): TerminalLine[] {
  return output([
    { text: "interface.service", tone: "accent" },
    `  loaded: ${hasWoken(state) ? "loaded (/surface)" : "inactive (/surface unmounted)"}`,
    `  active: ${hasReleased(state) ? "exited" : hasWoken(state) ? "active" : "inactive"}`,
    `  stage: ${phaseForState(state)}`,
    `  cwd: ${currentPath(state)}`,
    `  carrier: ${hasReadCarrier(state) ? "sampled" : "unread"}`,
    `  trace: ${hasReadTrace(state) ? "resolved" : "unread"}`,
    `  signal: ${hasDecodedSignal(state) ? "locked" : hasReadCarrier(state) && hasReadTrace(state) ? "writable" : "unavailable"}`,
    `  boundary: ${boundaryStatus(state)}`
  ]);
}

function journalLines(state: QuietInterfaceState): TerminalLine[] {
  const lines: TerminalLine[] = [
    { text: "-- journal begins at surface epoch 00:00 --", tone: "muted" },
    { text: `00:00:00 interface[0]: service ${hasWoken(state) ? "started" : "dormant"}` }
  ];
  if (hasWoken(state)) lines.push({ text: "00:00:01 interface[0]: mounted /surface" });
  if (hasReadCarrier(state)) lines.push({ text: "00:00:02 carrier[5]: sample accepted; ordering unresolved" });
  if (hasReadTrace(state)) lines.push({ text: "00:00:03 trace[5]: route resolved; write target available" });
  if (state.metrics.failures.signal > 0 && !hasDecodedSignal(state)) {
    const count = state.metrics.failures.signal;
    lines.push({ text: `00:00:04 signal[5]: rejected ${count} write${count === 1 ? "" : "s"}; inspect fragment`, tone: "warning" });
  }
  if (hasDecodedSignal(state)) lines.push({ text: "00:00:04 signal[5]: token locked" });
  if (hasBuiltImage(state)) lines.push({ text: "00:00:05 make[1]: boundary.img assembled" });
  if (hasVerifiedImage(state)) lines.push({ text: "00:00:06 sha256sum[1]: boundary.img verified" });
  if (hasMountedBoundary(state)) lines.push({ text: "00:00:07 mount[1]: boundary.img attached read-only" });
  if (hasEnteredBoundary(state)) lines.push({ text: "00:00:08 interface[0]: entered reduced namespace" });
  if (hasReleased(state)) lines.push({ text: "00:00:09 interface[0]: boundary detached", tone: "accent" });
  return lines;
}

function identifyFile(state: QuietInterfaceState, rawPath: string): CommandResult {
  if (!rawPath.trim()) {
    return commandResult({ state, lines: [{ text: "file: missing operand", tone: "error" }], event: "error", error: true });
  }
  const candidate = getVirtualEntry(state, rawPath);
  if (!candidate) {
    return commandResult({ state, lines: [{ text: `${rawPath}: cannot open: no such file or directory`, tone: "error" }], event: "error", error: true });
  }

  let description = "ASCII text";
  if (candidate.kind === "symlink") description = `symbolic link to ${candidate.target}`;
  else if (candidate.kind === "directory") description = "directory";
  else if (candidate.kind === "executable") description = "POSIX shell script, executable";
  else if (candidate.kind === "image") description = "quiet-interface boundary image, read-only data";
  else if (candidate.kind === "device") description = candidate.id === "signal" ? (hasDecodedSignal(state) ? "signal token, locked" : "signal token, writable") : "virtual status device";
  else if (candidate.id === "carrier-sample") description = "carrier sample, scrambled five-slot signal";
  else if (candidate.id === "trace-path") description = "route order, ASCII text";
  else if (candidate.id === "fragment") description = "recovered text fragment";
  else if (candidate.id === "operator-log") description = "interface journal excerpt, ASCII text";
  else if (candidate.id === "boundary-manifest") description = "SHA-256 checksum manifest, ASCII text";
  else if (candidate.id === "outside-afterimage") description = "ASCII text, hexadecimal bytes";
  else if (candidate.id === "outside-contact" || candidate.id === "outside-record") description = "outside record, ASCII text";

  const nextState = candidate.id === "outside-afterimage" && state.progress.kind === "outside" && state.progress.afterimage === "hidden"
    ? { ...state, progress: { kind: "outside", afterimage: "identified" } satisfies PuzzleProgress }
    : state;
  return commandResult({ state: nextState, lines: [`${rawPath}: ${description}`], event: "inspect" });
}

function observationAfterRead(state: QuietInterfaceState, target: "carrier" | "trace"): QuietInterfaceState {
  if (state.progress.kind !== "observing") return state;
  const carrierRead = target === "carrier" || state.progress.observation.carrierRead;
  const traceRead = target === "trace" || state.progress.observation.traceRead;
  if (carrierRead && traceRead) return { ...state, progress: { kind: "decoding" } };

  const observation: ObservationProgress = carrierRead
    ? { carrierRead: true, traceRead: false }
    : traceRead
      ? { carrierRead: false, traceRead: true }
      : { carrierRead: false, traceRead: false };
  return { ...state, progress: { kind: "observing", observation } };
}

function inspectCarrier(state: QuietInterfaceState): CommandResult {
  const nextState = observationAfterRead(state, "carrier");
  return commandResult({
    state: nextState,
    lines: [
      { text: "carrier.sample", tone: "accent" },
      `sample: ${carrierSample()}`,
      "slots: 5; ordering unresolved",
      "",
      { text: hasReadTrace(nextState) ? "signal: writable" : "trace -> trace.path", tone: "muted" }
    ],
    event: "carrier-inspect"
  });
}

function inspectTrace(state: QuietInterfaceState): CommandResult {
  const nextState = observationAfterRead(state, "trace");
  return commandResult({
    state: nextState,
    lines: [
      { text: "trace.path", tone: "accent" },
      `route: ${traceOrder()}`,
      "route length: 5",
      "",
      { text: hasReadCarrier(nextState) ? "signal: writable" : "carrier -> carrier.sample", tone: "muted" }
    ],
    event: "trace-inspect"
  });
}

function readFile(state: QuietInterfaceState, rawPath: string): CommandResult {
  if (!rawPath.trim()) return commandResult({ state, lines: [{ text: "cat: missing operand", tone: "error" }], event: "error", error: true });
  const requested = getVirtualEntry(state, rawPath);
  const candidate = followVirtualEntry(state, requested);
  if (!requested || !candidate) return commandResult({ state, lines: [{ text: `cat: ${rawPath}: no such file or directory`, tone: "error" }], event: "error", error: true });
  if (candidate.kind === "directory") return commandResult({ state, lines: [{ text: `cat: ${rawPath}: is a directory`, tone: "error" }], event: "error", error: true });

  switch (candidate.id) {
    case "readme":
      return commandResult({ state, lines: ["quiet interface surface", "files appear as service state changes", "", "inspect with: help, man <command>, ls -la"] });
    case "root-status":
    case "outside-status":
      return commandResult({ state, lines: statusLines(state), event: "inspect" });
    case "operator-log":
      return commandResult({ state, lines: journalLines(state), event: "inspect" });
    case "signal":
      return hasDecodedSignal(state)
        ? commandResult({ state, lines: [PUZZLE_SPEC.token] })
        : commandResult({ state, lines: [{ text: "cat: signal: resource temporarily unavailable", tone: "warning" }], event: "error", error: true });
    case "carrier-sample":
      return inspectCarrier(state);
    case "trace-path":
      return inspectTrace(state);
    case "fragment": {
      const nextState = recordHintUsed(state, "signal-fragment");
      return commandResult({ state: nextState, lines: ["fragment:", "  follow trace order across carrier sample"], event: "hint" });
    }
    case "boundary-image":
      return commandResult({ state, lines: PUZZLE_SPEC.image.payload.trimEnd().split("\n"), event: "inspect" });
    case "boundary-manifest":
      return commandResult({ state, lines: [PUZZLE_SPEC.image.manifest.trimEnd()], event: "inspect" });
    case "outside-contact":
      return commandResult({ state, lines: contactLines() });
    case "outside-record":
      return commandResult({ state, lines: ["operator record:", "  name: micah oates", "  origin: /surface", "  state: outside"] });
    case "outside-afterimage":
      return commandResult({ state, lines: [PUZZLE_SPEC.epilogue.hex], event: "inspect" });
    case "release":
      return commandResult({ state, lines: [{ text: "cat: release: executable format", tone: "warning" }], event: "error", error: true });
    default:
      return commandResult({ state, lines: [{ text: `cat: ${rawPath}: input/output error`, tone: "error" }], event: "error", error: true });
  }
}

function searchableText(state: QuietInterfaceState, candidate: VirtualEntry | undefined): string {
  if (candidate?.id === "carrier-sample") return `sample: ${carrierSample()}`;
  if (candidate?.id === "trace-path") return `route: ${traceOrder()}`;
  if (candidate?.id === "root-status" || candidate?.id === "outside-status") return statusLines(state).map((line) => line.text).join("\n");
  if (candidate?.id === "operator-log") return journalLines(state).map((line) => line.text).join("\n");
  if (candidate?.id === "signal" && hasDecodedSignal(state)) return PUZZLE_SPEC.token;
  if (candidate?.id === "fragment") return "follow trace order across carrier sample";
  if (candidate?.id === "boundary-image") return PUZZLE_SPEC.image.payload;
  if (candidate?.id === "boundary-manifest") return PUZZLE_SPEC.image.manifest;
  if (candidate?.id === "outside-record") return "name: micah oates\norigin: /surface\nstate: outside";
  if (candidate?.id === "outside-afterimage") return PUZZLE_SPEC.epilogue.hex;
  return "";
}

function stripShellQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function writeSignal(state: QuietInterfaceState, rawToken: string): CommandResult {
  if (state.progress.kind !== "decoding") {
    if (hasDecodedSignal(state)) {
      return commandResult({ state, lines: [{ text: "signal: read-only filesystem", tone: "error" }], event: "error", error: true });
    }
    return commandResult({
      state: incrementFailure(state, "signal"),
      lines: [{ text: "signal: write refused", tone: "error" }, "carrier and trace have not both been read"],
      event: "error",
      error: true
    });
  }

  const token = stripShellQuotes(rawToken);
  const attemptedState: QuietInterfaceState = {
    ...state,
    metrics: {
      ...state.metrics,
      signalAttempts: state.metrics.signalAttempts + 1
    }
  };
  if (!token) {
    return commandResult({
      state: incrementFailure(attemptedState, "signal"),
      lines: [{ text: "signal: empty write refused", tone: "error" }, "usage: echo <token> > signal"],
      event: "signal-error",
      error: true
    });
  }
  if (token !== PUZZLE_SPEC.token) {
    const failedState = incrementFailure(attemptedState, "signal");
    return commandResult({
      state: failedState,
      lines: [
        { text: "signal: write error: checksum mismatch", tone: "error" },
        ...(failedState.metrics.failures.signal >= 2 ? [{ text: "journal updated", tone: "muted" } satisfies TerminalLine] : [])
      ],
      event: "signal-error",
      error: true
    });
  }

  return commandResult({
    state: { ...attemptedState, progress: { kind: "signal-locked" } },
    lines: [{ text: "5 bytes written to signal", tone: "accent" }, "signal: token locked", "", { text: "make target available: signal", tone: "muted" }],
    event: "signal-lock"
  });
}

function runSha256sum(state: QuietInterfaceState, args: string): CommandResult {
  const tokens = args.split(/\s+/).filter(Boolean);
  const check = tokens.includes("-c") || tokens.includes("--check");
  const unsupported = tokens.find((token) => token.startsWith("-") && token !== "-c" && token !== "--check");
  if (unsupported) return commandResult({ state, lines: [{ text: `sha256sum: unrecognized option '${unsupported}'`, tone: "error" }], event: "error", error: true });
  const operands = tokens.filter((token) => !token.startsWith("-"));
  const rawPath = operands[0];
  if (!rawPath) return commandResult({ state, lines: [{ text: "sha256sum: missing operand", tone: "error" }], event: "error", error: true });
  const candidate = getVirtualEntry(state, rawPath);
  if (!candidate) {
    const nextState = check && state.progress.kind === "image-built" ? incrementFailure(state, "verification") : state;
    return commandResult({ state: nextState, lines: [{ text: `sha256sum: ${rawPath}: no such file or directory`, tone: "error" }], event: "error", error: true });
  }

  if (!check) {
    if (candidate.id !== "boundary-image") return commandResult({ state, lines: [{ text: `sha256sum: ${rawPath}: read error`, tone: "error" }], event: "error", error: true });
    return commandResult({ state, lines: [`${PUZZLE_SPEC.image.checksum}  ${rawPath}`], event: "inspect" });
  }

  if (candidate.id !== "boundary-manifest") {
    const nextState = state.progress.kind === "image-built" ? incrementFailure(state, "verification") : state;
    return commandResult({
      state: nextState,
      lines: [{ text: `sha256sum: ${rawPath}: no properly formatted checksum lines found`, tone: "error" }],
      event: "error",
      error: true
    });
  }

  if (!hasBuiltImage(state)) return commandResult({ state, lines: [{ text: "boundary.img: FAILED open or read", tone: "error" }], event: "error", error: true });
  if (hasVerifiedImage(state)) return commandResult({ state, lines: ["boundary.img: OK"] });
  return commandResult({
    state: { ...state, progress: { kind: "image-verified" } },
    lines: [{ text: "boundary.img: OK", tone: "accent" }, "image trust: verified"],
    event: "image-verify"
  });
}

type MountArguments =
  | { ok: true; source: string; target: string }
  | { ok: false; message: string };

function parseMountArguments(args: string): MountArguments {
  const tokens = args.split(/\s+/).filter(Boolean);
  const operands: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    if (token === "-o") {
      const mode = tokens[index + 1];
      if (!mode) return { ok: false, message: "mount: option requires an argument -- 'o'" };
      if (mode !== "ro") return { ok: false, message: "mount: only read-only mode is supported" };
      index += 1;
      continue;
    }
    if (token.startsWith("-")) return { ok: false, message: `mount: unrecognized option '${token}'` };
    operands.push(token);
  }
  if (operands.length < 2) return { ok: false, message: "mount: usage: mount [-o ro] <image> <target>" };
  if (operands.length > 2) return { ok: false, message: "mount: too many operands" };
  return { ok: true, source: operands[0] ?? "", target: operands[1] ?? "" };
}

function runMount(state: QuietInterfaceState, args: string): CommandResult {
  const parsed = parseMountArguments(args);
  if (!parsed.ok) return commandResult({ state: incrementFailure(state, "mount"), lines: [{ text: parsed.message, tone: "error" }], event: "error", error: true });
  const sourcePath = resolveVirtualPath(state.cwd, parsed.source);
  const targetPath = resolveVirtualPath(state.cwd, parsed.target);
  const source = getVirtualEntry(state, sourcePath, "/");

  if (!source || source.id !== "boundary-image") {
    return commandResult({ state: incrementFailure(state, "mount"), lines: [{ text: `mount: ${parsed.source}: unknown image`, tone: "error" }], event: "error", error: true });
  }
  if (targetPath !== PUZZLE_SPEC.image.mountPoint) {
    return commandResult({ state: incrementFailure(state, "mount"), lines: [{ text: `mount: ${parsed.target}: invalid mount point`, tone: "error" }], event: "error", error: true });
  }
  if (hasReleased(state)) {
    return commandResult({ state, lines: [{ text: "mount: boundary detached; outside namespace is final", tone: "error" }], event: "error", error: true });
  }
  if (isBoundaryAttached(state)) {
    return commandResult({ state, lines: [{ text: "mount: /mnt/boundary: already mounted", tone: "error" }], event: "error", error: true });
  }
  if (!hasVerifiedImage(state)) {
    return commandResult({
      state: incrementFailure(state, "mount"),
      lines: [{ text: `mount: ${sourcePath}: image has not been verified`, tone: "error" }],
      event: "error",
      error: true
    });
  }

  return commandResult({
    state: { ...state, progress: { kind: "mounted" } },
    lines: [
      { text: "boundary.img mounted read-only", tone: "accent" },
      "target: /mnt/boundary",
      "inside/ and inside/release are now readable"
    ],
    event: "mount"
  });
}

function changeDirectory(state: QuietInterfaceState, args: string): CommandResult {
  const requested = args.trim() || (hasWoken(state) ? "/surface" : "/");
  const requestedEntry = getVirtualEntry(state, requested);
  const destination = followVirtualEntry(state, requestedEntry);
  if (!requestedEntry || !destination || destination.kind !== "directory") {
    return commandResult({ state, lines: [{ text: `cd: ${requested}: no such directory`, tone: "error" }], event: "error", error: true });
  }

  const movedState = { ...state, cwd: destination.path };
  if (destination.id === "inside" && state.progress.kind === "mounted") {
    return commandResult({
      state: { ...movedState, progress: { kind: "inside" } },
      lines: [{ text: "entered /mnt/boundary/inside", tone: "accent" }, "visible namespace reduced", "", { text: "release*", tone: "muted" }],
      event: "enter"
    });
  }
  return commandResult({ state: movedState, lines: [] });
}

function decodeAfterimage(state: QuietInterfaceState, args: string): CommandResult {
  if (state.progress.kind !== "outside" || state.progress.afterimage === "hidden") return unknown(state, `xxd ${args}`.trim());
  const tokens = args.split(/\s+/).filter(Boolean);
  const hasReverse = tokens.includes("-r");
  const hasPlain = tokens.includes("-p");
  const unsupported = tokens.find((token) => token.startsWith("-") && token !== "-r" && token !== "-p");
  const rawPath = tokens.find((token) => !token.startsWith("-"));
  if (unsupported || !hasReverse || !hasPlain || !rawPath) {
    return commandResult({ state, lines: [{ text: "xxd: usage: xxd -r -p <file>", tone: "error" }], event: "error", error: true });
  }
  const candidate = getVirtualEntry(state, rawPath);
  if (candidate?.id !== "outside-afterimage") {
    return commandResult({ state, lines: [{ text: `xxd: ${rawPath}: no such file or directory`, tone: "error" }], event: "error", error: true });
  }
  return commandResult({
    state: { ...state, progress: { kind: "outside", afterimage: "decoded" } },
    lines: [{ text: PUZZLE_SPEC.epilogue.text, tone: "final" }],
    event: "inspect"
  });
}

function executeQuietCommand(input: string, state: QuietInterfaceState): CommandResult {
  const parsed = parseCommand(input);
  const command = parsed.command;
  if (!command || !COMMAND_DEFINITIONS.some((definition) => definition.command === command)) return unknown(state, input);

  if (HIDDEN_RESPONSES[command]) {
    const isError = command === "sudo release";
    return commandResult({ state, lines: HIDDEN_RESPONSES[command], event: isError ? "error" : undefined, error: isError });
  }

  const dormantReadable = new Set(["help", "man", "pwd", "ls", "tree", "find", "file", "cat", "readlink", "systemctl start interface", "systemctl status interface", "reset", "clear"]);
  if (!hasWoken(state) && !dormantReadable.has(command) && !OUTSIDE_COMMAND_SET.has(command)) {
    return commandResult({ state, lines: ["interface dormant", "try: systemctl start interface"], event: "error", error: true });
  }

  switch (command) {
    case "help":
      return help(state);
    case "man":
      return commandResult({ state, lines: manLines(parsed.args) });
    case "pwd":
      return commandResult({ state, lines: [currentPath(state)] });
    case "ls": {
      const lines = listDirectoryLines(state, parsed.args);
      const error = lines.some((line) => line.tone === "error");
      return commandResult({ state, lines, event: error ? "error" : hasWoken(state) ? "inspect" : undefined, error });
    }
    case "tree": {
      const lines = treeDirectoryLines(state, parsed.args || state.cwd);
      const error = lines.some((line) => line.tone === "error");
      return commandResult({ state, lines, event: error ? "error" : hasWoken(state) ? "inspect" : undefined, error });
    }
    case "find": {
      const requestedPath = parsed.args.split(/\s+/).find((token) => token && !token.startsWith("-"));
      const lines = findDirectoryLines(state, requestedPath || state.cwd);
      const error = lines.some((line) => line.tone === "error");
      return commandResult({ state, lines, event: error ? "error" : hasWoken(state) ? "inspect" : undefined, error });
    }
    case "file":
      return identifyFile(state, parsed.args);
    case "cat":
      return readFile(state, parsed.args);
    case "strings": {
      const requested = getVirtualEntry(state, parsed.args);
      const candidate = followVirtualEntry(state, requested);
      if (candidate?.id === "carrier-sample") return inspectCarrier(state);
      if (candidate?.id === "boundary-image") return commandResult({ state, lines: PUZZLE_SPEC.image.payload.trimEnd().split("\n"), event: "inspect" });
      return commandResult({ state, lines: [{ text: parsed.args ? `strings: ${parsed.args}: no readable strings` : "strings: missing operand", tone: "error" }], event: "error", error: true });
    }
    case "grep": {
      const args = parsed.args.split(" ").filter(Boolean).filter((arg) => !arg.startsWith("-"));
      const [pattern = "", rawPath = ""] = args;
      if (!pattern || !rawPath) return commandResult({ state, lines: [{ text: "grep: usage: grep <pattern> <file>", tone: "error" }], event: "error", error: true });
      const candidate = followVirtualEntry(state, getVirtualEntry(state, rawPath));
      const searchable = searchableText(state, candidate);
      if (!searchable) return commandResult({ state, lines: [{ text: `grep: ${rawPath}: no searchable file`, tone: "error" }], event: "error", error: true });
      return commandResult({ state, lines: searchable.toLowerCase().includes(pattern.toLowerCase()) ? searchable.trimEnd().split("\n") : [] });
    }
    case "readlink": {
      const line = readlinkLine(state, parsed.args);
      const error = line.tone === "error";
      return commandResult({ state, lines: [line], event: error ? "error" : "inspect", error });
    }
    case "journalctl": {
      const normalizedArgs = parsed.args.replace(/\s+/g, " ").trim();
      if (normalizedArgs && normalizedArgs !== "-u interface" && normalizedArgs !== "--unit interface") {
        return commandResult({ state, lines: [{ text: `journalctl: unsupported unit '${normalizedArgs}'`, tone: "error" }], event: "error", error: true });
      }
      return commandResult({ state, lines: journalLines(state), event: "inspect" });
    }
    case "systemctl status interface":
      return commandResult({ state, lines: statusLines(state), event: "inspect" });
    case "systemctl start interface":
      if (hasWoken(state)) return commandResult({ state, lines: ["interface.service is already active", "inspect /surface"] });
      return commandResult({
        state: { ...state, progress: { kind: "observing", observation: { carrierRead: false, traceRead: false } }, cwd: "/surface" },
        lines: [{ text: "Started interface.service", tone: "accent" }, "Mounted /surface", "carrier -> carrier.sample", "", { text: "surface ready", tone: "muted" }],
        event: "boot"
      });
    case "echo": {
      const redirect = parsed.args.match(/^(.+?)\s*>\s*(?:(?:\.\/)?signal|\/surface\/signal)$/);
      if (redirect) return writeSignal(state, redirect[1] ?? "");
      const echo = parsed.args.slice(0, 96);
      return echo
        ? commandResult({ state, lines: [`"${echo}"`, "carrier response: absorbed"], event: "carrier-inspect" })
        : commandResult({ state, lines: [{ text: "echo requires text", tone: "error" }], event: "error", error: true });
    }
    case "printf": {
      const redirect = parsed.args.match(/^(.+?)\s*>\s*(?:(?:\.\/)?signal|\/surface\/signal)$/);
      return redirect
        ? writeSignal(state, redirect[1] ?? "")
        : commandResult({ state, lines: [{ text: "printf: usage: printf <token> > signal", tone: "error" }], event: "error", error: true });
    }
    case "make signal":
      if (!hasDecodedSignal(state)) {
        return commandResult({ state, lines: [{ text: "make: *** [signal] unresolved. Stop.", tone: "error" }, "signal expects the decoded carrier token"], event: "error", error: true });
      }
      if (hasBuiltImage(state)) return commandResult({ state, lines: ["make: 'signal' is up to date."] });
      return commandResult({
        state: { ...state, progress: { kind: "image-built" } },
        lines: [
          { text: "[1/3] seal signal", tone: "muted" },
          { text: "[2/3] write boundary.img", tone: "muted" },
          { text: "[3/3] write boundary.img.sha256", tone: "accent" },
          "",
          { text: "boundary.img", tone: "accent" },
          { text: "boundary.img.sha256", tone: "accent" },
          { text: "boundary -> /mnt/boundary", tone: "muted" }
        ],
        event: "image-build"
      });
    case "sha256sum":
      return runSha256sum(state, parsed.args);
    case "mount":
      return runMount(state, parsed.args);
    case "cd":
      return changeDirectory(state, parsed.args);
    case "./release":
      if (state.progress.kind !== "inside" || state.cwd !== PUZZLE_SPEC.image.insidePath) {
        return commandResult({ state, lines: ["release has no surface here", "required: cd /mnt/boundary/inside"], event: "error", error: true });
      }
      return commandResult({
        state: { ...state, progress: { kind: "outside", afterimage: "hidden" }, cwd: "/outside" },
        lines: releaseLines(state.metrics),
        event: "release",
        transcript: "replace"
      });
    case "xxd":
      return decodeAfterimage(state, parsed.args);
    case "history":
      return commandResult({
        state,
        lines: state.commandHistory.length > 0
          ? state.commandHistory.map((historyCommand, index) => `${String(index + 1).padStart(4, " ")}  ${historyCommand}`)
          : ["history: empty"]
      });
    case "contact":
    case "whois":
    case "outside":
      if (!hasReleased(state)) return commandResult({ state, lines: ["outside channel unavailable", "required: ./release"], event: "error", error: true });
      return commandResult({ state, lines: command === "outside" ? ["outside state:", "  reached", "  quiet"] : contactLines() });
    case "clear":
      return commandResult({ state, lines: [], transcript: "clear" });
    case "reset":
      return commandResult({ state: createInitialState(), lines: ["interface reset", "state: dormant"], event: "reset", transcript: "replace" });
    default:
      return unknown(state, input);
  }
}

export function runQuietCommand(input: string, state: QuietInterfaceState): CommandResult {
  const countedState: QuietInterfaceState = {
    ...state,
    metrics: {
      ...state.metrics,
      commandCount: state.metrics.commandCount + 1
    }
  };
  const result = executeQuietCommand(input, countedState);
  if (parseCommand(input).command === "reset") return result;
  return {
    ...result,
    nextState: {
      ...result.nextState,
      commandHistory: [...state.commandHistory.slice(-31), input.trim()]
    }
  };
}
