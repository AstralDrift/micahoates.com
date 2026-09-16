import { COMMAND_DEFINITIONS } from "@/lib/quiet-interface/copy";
import { progressAtLeast, type QuietInterfaceState } from "@/lib/quiet-interface/state";

export type ParsedCommand = {
  command: string;
  args: string;
};

export const BASE_COMMANDS = [
  "help",
  "man",
  "pwd",
  "ls",
  "tree",
  "find",
  "file",
  "cat",
  "readlink",
  "systemctl start interface",
  "systemctl status interface",
  "clear",
  "reset"
] as const;

export const OBSERVATION_COMMANDS = ["strings", "grep", "journalctl", "echo", "printf", "history", "cd"] as const;
export const ASSEMBLY_COMMANDS = ["make signal"] as const;
export const IMAGE_COMMANDS = ["sha256sum", "mount"] as const;
export const INSIDE_COMMANDS = ["./release"] as const;
export const OUTSIDE_COMMANDS = ["contact", "whois", "outside"] as const;

const MULTI_WORD_COMMANDS = [
  "systemctl start interface",
  "systemctl status interface",
  "make signal",
  "sudo release"
] as const;

const aliasMap = new Map<string, string>();

for (const definition of COMMAND_DEFINITIONS) {
  aliasMap.set(definition.command, definition.command);
  for (const alias of definition.aliases ?? []) {
    aliasMap.set(alias, definition.command);
  }
}

function normalizeInput(input: string): string {
  return input.trim().toLowerCase().replace(/^\/+/, "").replace(/\s+/g, " ");
}

export function parseCommand(input: string): ParsedCommand {
  const normalized = normalizeInput(input);
  const multiWordMatch = MULTI_WORD_COMMANDS.find(
    (command) => normalized === command || normalized.startsWith(`${command} `)
  );

  if (multiWordMatch) {
    return {
      command: aliasMap.get(multiWordMatch) ?? multiWordMatch,
      args: normalized.slice(multiWordMatch.length).trim()
    };
  }

  const [head = "", ...rest] = normalized.split(" ");
  return {
    command: aliasMap.get(head) ?? head,
    args: rest.join(" ").trim()
  };
}

export function availableCommands(state: QuietInterfaceState) {
  const available = new Set<string>(BASE_COMMANDS);

  if (progressAtLeast(state.progress, "observing")) {
    for (const command of OBSERVATION_COMMANDS) available.add(command);
  }

  if (progressAtLeast(state.progress, "decoding")) {
    for (const command of ASSEMBLY_COMMANDS) available.add(command);
  }

  if (progressAtLeast(state.progress, "image-built")) {
    for (const command of IMAGE_COMMANDS) available.add(command);
  }

  if (state.progress.kind === "inside") {
    for (const command of INSIDE_COMMANDS) available.add(command);
  }

  if (state.progress.kind === "outside") {
    for (const command of OUTSIDE_COMMANDS) available.add(command);
    if (state.progress.afterimage !== "hidden") available.add("xxd");
  }

  return COMMAND_DEFINITIONS.filter((definition) => available.has(definition.command) && !definition.hidden);
}

export function commandSuggestions(state: QuietInterfaceState) {
  return availableCommands(state).map((definition) => definition.command);
}
