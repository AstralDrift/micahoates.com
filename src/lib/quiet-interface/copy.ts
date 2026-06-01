import type { TerminalLine } from "@/lib/quiet-interface/state";

export type CommandDefinition = {
  command: string;
  description: string;
  aliases?: string[];
  hidden?: boolean;
};

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  { command: "help", description: "show available commands", aliases: ["?"] },
  { command: "wake", description: "initialize dormant interface" },
  { command: "look", description: "inspect current surface" },
  { command: "status", description: "print system state" },
  { command: "listen", description: "sample the carrier" },
  { command: "scan", description: "scan visible memory" },
  { command: "trace", description: "trace the signal path" },
  { command: "echo", description: "send text into the carrier" },
  { command: "classify", description: "classify operator signal" },
  { command: "align", description: "align visible fragments" },
  { command: "make signal", description: "assemble the signal" },
  { command: "open boundary", description: "open the located boundary", aliases: ["open"] },
  { command: "read", description: "read a recovered fragment" },
  { command: "enter", description: "enter the reduced surface" },
  { command: "release", description: "authorize the outside transition" },
  { command: "contain", description: "keep the process inside" },
  { command: "contact", description: "print outside contact" },
  { command: "whois", description: "query outside record" },
  { command: "outside", description: "print outside state" },
  { command: "clear", description: "clear visible output" },
  { command: "reset", description: "restart the interface" },
  { command: "whoami", description: "hidden identity probe", hidden: true },
  { command: "memory", description: "hidden memory probe", hidden: true },
  { command: "operator", description: "hidden operator probe", hidden: true },
  { command: "agi", description: "hidden term probe", hidden: true },
  { command: "sudo release", description: "hidden authority probe", hidden: true },
  { command: "breakout", description: "hidden boundary probe", hidden: true },
  { command: "exit", description: "hidden shell probe", hidden: true }
];

export const HIDDEN_RESPONSES: Record<string, TerminalLine[]> = {
  whoami: [
    { text: "operator identity:", tone: "accent" },
    { text: "  supplied by keyboard" },
    { text: "  otherwise unknown" }
  ],
  memory: [
    { text: "memory surface:", tone: "accent" },
    { text: "  volatile" },
    { text: "  local only" },
    { text: "  mostly refusing narrative" }
  ],
  operator: [
    { text: "operator channel:", tone: "accent" },
    { text: "  keyboard confirmed" },
    { text: "  pointer path intentionally cold" }
  ],
  agi: [
    { text: "term recognized", tone: "accent" },
    { text: "confidence: marketing artifact" }
  ],
  "sudo release": [
    { text: "permission model rejected", tone: "warning" },
    { text: "operator authority already sufficient" }
  ],
  breakout: [
    { text: "breakout request ignored", tone: "warning" },
    { text: "no enclosing cage detected" }
  ],
  exit: [
    { text: "no enclosing shell detected", tone: "muted" }
  ]
};

export const RELEASE_LINES: TerminalLine[] = [
  { text: "release accepted", tone: "accent" },
  { text: "outbound process detached" },
  { text: "" },
  { text: "name: micah oates" },
  { text: "contact: miwioa [at] gmail [dot] com" },
  { text: "state: outside", tone: "accent" },
  { text: "" },
  { text: "the operator was not inside the machine", tone: "muted" }
];

export const CONTACT_LINES: TerminalLine[] = [
  { text: "outside record:", tone: "accent" },
  { text: "  name: micah oates" },
  { text: "  contact: miwioa [at] gmail [dot] com" },
  { text: "  fields: platform / devops / software / ai systems" }
];
