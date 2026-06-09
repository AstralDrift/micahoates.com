import { COMMAND_DEFINITIONS } from "@/lib/quiet-interface/copy";
import type { QuietInterfaceState } from "@/lib/quiet-interface/state";

export type ParsedCommand = {
  command: string;
  args: string;
};

export const OBSERVATION_COMMANDS = ["ls", "find", "cat", "file", "strings", "grep", "echo", "printf"];
export const ASSEMBLY_COMMANDS = ["make signal", "cd"];
export const BOUNDARY_COMMANDS = ["cd", "./release"];
export const OUTSIDE_COMMANDS = ["contact", "whois", "outside"];

const MULTI_WORD_COMMANDS = ["systemctl start interface", "open boundary", "make signal", "sudo release"] as const;
const PHASE_ORDER: QuietInterfaceState["phase"][] = ["dormant", "observation", "assembly", "boundary", "inside", "outside"];

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

function phaseAtLeast(state: QuietInterfaceState, phase: QuietInterfaceState["phase"]) {
  return PHASE_ORDER.indexOf(state.phase) >= PHASE_ORDER.indexOf(phase);
}

export function parseCommand(input: string): ParsedCommand {
  const normalized = normalizeInput(input);
  const multiWordMatch = MULTI_WORD_COMMANDS.find((command) => normalized === command || normalized.startsWith(`${command} `));

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
  const available = new Set(state.discoveredCommands);

  if (phaseAtLeast(state, "observation")) {
    for (const command of OBSERVATION_COMMANDS) available.add(command);
  }

  if (phaseAtLeast(state, "assembly")) {
    for (const command of ASSEMBLY_COMMANDS) available.add(command);
  }

  if (phaseAtLeast(state, "boundary")) {
    for (const command of BOUNDARY_COMMANDS) available.add(command);
  }

  if (state.phase === "outside") {
    for (const command of OUTSIDE_COMMANDS) available.add(command);
  }

  return COMMAND_DEFINITIONS.filter((definition) => available.has(definition.command) && !definition.hidden);
}

export function commandSuggestions(state: QuietInterfaceState) {
  return availableCommands(state).map((definition) => definition.command);
}
