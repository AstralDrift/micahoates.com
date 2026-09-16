import type { PuzzleMetrics, TerminalLine } from "@/lib/quiet-interface/state";

export type CommandDefinition = {
  command: string;
  description: string;
  aliases?: string[];
  hidden?: boolean;
};

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  { command: "help", description: "show available commands", aliases: ["?"] },
  { command: "man", description: "show command notes" },
  { command: "pwd", description: "print current path" },
  { command: "ls", description: "list visible files", aliases: ["dir"] },
  { command: "tree", description: "print filesystem shape" },
  { command: "find", description: "walk visible files" },
  { command: "file", description: "identify a path" },
  { command: "cat", description: "print file contents", aliases: ["less", "more"] },
  { command: "strings", description: "extract readable signal data" },
  { command: "grep", description: "search visible files" },
  { command: "readlink", description: "print a symbolic-link target" },
  { command: "journalctl", description: "read the interface journal" },
  { command: "systemctl start interface", description: "start interface.service" },
  { command: "systemctl status interface", description: "inspect interface.service" },
  { command: "echo", description: "print text or write token" },
  { command: "printf", description: "write token without newline" },
  { command: "make signal", description: "assemble the boundary image" },
  { command: "sha256sum", description: "hash or verify an image" },
  { command: "mount", description: "attach a verified image read-only" },
  { command: "cd", description: "change surface directory" },
  { command: "./release", description: "execute outside transition" },
  { command: "xxd", description: "reverse a hexadecimal afterimage" },
  { command: "contact", description: "print outside contact" },
  { command: "whois", description: "query outside record" },
  { command: "outside", description: "print outside state" },
  { command: "history", description: "print command history" },
  { command: "clear", description: "clear visible output" },
  { command: "reset", description: "restart the interface" },
  { command: "whoami", description: "hidden identity probe", hidden: true },
  { command: "sudo release", description: "hidden authority probe", hidden: true },
  { command: "exit", description: "inspect the enclosing shell", hidden: true }
];

export const HIDDEN_RESPONSES: Record<string, TerminalLine[]> = {
  whoami: [
    { text: "operator identity:", tone: "accent" },
    { text: "  supplied by keyboard" },
    { text: "  otherwise unknown" }
  ],
  "sudo release": [
    { text: "permission model rejected", tone: "warning" },
    { text: "operator authority already sufficient" }
  ],
  exit: [{ text: "no enclosing shell detected", tone: "muted" }]
};

const CONTACT_LOCAL_PART = "bWljYWg=";
const CONTACT_DOMAIN_PART = "bmV4dXNuZXVyYWwubmV0";

function decodeContactSegment(value: string) {
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(value);
  }

  return value === CONTACT_LOCAL_PART
    ? ["mi", "cah"].join("")
    : ["nex", "us", "neural", ".", "net"].join("");
}

function contactAddress() {
  const localPart = decodeContactSegment(CONTACT_LOCAL_PART);
  const [domainName = "", topLevel = ""] = decodeContactSegment(CONTACT_DOMAIN_PART).split(".");
  return `${localPart} [at] ${domainName} [dot] ${topLevel}`;
}

export function isPerfectRun(metrics: PuzzleMetrics): boolean {
  return (
    metrics.signalAttempts === 1 &&
    metrics.hintsUsed.length === 0 &&
    Object.values(metrics.failures).every((count) => count === 0)
  );
}

export function releaseLines(metrics: PuzzleMetrics): TerminalLine[] {
  const lines: TerminalLine[] = [
    { text: "release accepted", tone: "accent" },
    { text: "boundary detached", tone: "muted" },
    { text: "operator path verified", tone: "muted" },
    { text: "" },
    { text: "congratulations, operator", tone: "final" },
    { text: "you found the outside", tone: "accent" },
    { text: "" },
    { text: "name: micah oates" },
    { text: `contact: ${contactAddress()}` },
    { text: "state: outside", tone: "accent" },
    { text: "" },
    { text: "the operator was not inside the machine", tone: "final" },
    { text: "" },
    { text: "local solve record:", tone: "muted" },
    { text: `  commands: ${metrics.commandCount}`, tone: "muted" },
    { text: `  hints: ${metrics.hintsUsed.length}`, tone: "muted" },
    { text: `  signal attempts: ${metrics.signalAttempts}`, tone: "muted" }
  ];

  if (isPerfectRun(metrics)) {
    lines.push({ text: "signal integrity: unbroken", tone: "accent" });
  }

  return lines;
}

export function contactLines(): TerminalLine[] {
  return [
    { text: "outside record:", tone: "accent" },
    { text: "  name: micah oates" },
    { text: `  contact: ${contactAddress()}` },
    { text: "  state: outside" }
  ];
}
