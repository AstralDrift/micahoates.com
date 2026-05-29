import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Braces,
  Cloud,
  Code2,
  Cpu,
  Layers3,
  Orbit,
  Repeat2,
  Search,
  ServerCog,
  Sparkles,
  Terminal,
  Trash2,
  Workflow
} from "lucide-react";

export const site = {
  name: "Micah Oates",
  domain: "micahoates.com",
  url: "https://micahoates.com",
  description:
    "Micah Oates works across software engineering, platform engineering, DevOps/SRE, cloud infrastructure, automation, and AI-enabled systems.",
  heroTagline: "Platform engineer. Systems builder. Automation-minded.",
  heroSummary: "I build reliable software, infrastructure, and AI-enabled systems."
} as const;

export type CommandKey = "help" | "about" | "stack" | "systems" | "automation" | "ai" | "clear";

export type Command = {
  key: CommandKey;
  label: string;
  shortcut: string;
  description: string;
  icon: LucideIcon;
};

export const commands: Command[] = [
  {
    key: "help",
    label: "help",
    shortcut: "h",
    description: "Show available commands",
    icon: Search
  },
  {
    key: "about",
    label: "about",
    shortcut: "a",
    description: "Open the short Micah context",
    icon: Terminal
  },
  {
    key: "stack",
    label: "stack",
    shortcut: "s",
    description: "View tools and technology areas",
    icon: Layers3
  },
  {
    key: "systems",
    label: "systems",
    shortcut: "m",
    description: "Render the systems map",
    icon: Orbit
  },
  {
    key: "automation",
    label: "automation",
    shortcut: "u",
    description: "Inspect automation patterns",
    icon: Workflow
  },
  {
    key: "ai",
    label: "ai",
    shortcut: "i",
    description: "Inspect AI-enabled workflows",
    icon: Bot
  },
  {
    key: "clear",
    label: "clear",
    shortcut: "x",
    description: "Reset the terminal session",
    icon: Trash2
  }
];

export const stackGroups = [
  {
    label: "Software",
    items: ["TypeScript", "React", "APIs", "interfaces"],
    icon: Braces
  },
  {
    label: "Cloud",
    items: ["cloud infrastructure", "runtime systems", "deployment"],
    icon: Cloud
  },
  {
    label: "DevOps/SRE",
    items: ["reliability", "delivery", "operations"],
    icon: ServerCog
  },
  {
    label: "AI",
    items: ["tooling", "assistive workflows", "evaluation"],
    icon: Bot
  },
  {
    label: "Automation",
    items: ["repeatable paths", "scripts", "runbooks"],
    icon: Workflow
  }
] as const;

export const systemNodes = [
  {
    label: "Software",
    note: "interfaces",
    x: 23,
    y: 44,
    icon: Code2,
    color: "cyan"
  },
  {
    label: "Cloud",
    note: "runtime",
    x: 50,
    y: 18,
    icon: Cloud,
    color: "cyan"
  },
  {
    label: "DevOps/SRE",
    note: "reliability",
    x: 77,
    y: 44,
    icon: Terminal,
    color: "green"
  },
  {
    label: "AI",
    note: "assistive workflows",
    x: 36,
    y: 76,
    icon: Sparkles,
    color: "violet"
  },
  {
    label: "Automation",
    note: "repeatable paths",
    x: 64,
    y: 76,
    icon: Repeat2,
    color: "green"
  }
] as const;

export const automationAreas = [
  "repeatable paths",
  "deployment flows",
  "scripts and runbooks",
  "operational feedback loops"
] as const;

export const aiAreas = [
  "assistive tooling",
  "human-in-the-loop workflows",
  "evaluation-minded interfaces",
  "automation with review points"
] as const;

export const terminalBootLines = [
  "booting micahoates.com",
  "loading terminal workspace",
  "type help or press ?"
] as const;

export const capabilitySignals = [
  { label: "software", value: "interfaces / runtime / delivery", icon: Code2 },
  { label: "platform", value: "cloud / reliability / operations", icon: ServerCog },
  { label: "automation", value: "repeatable work / workflow leverage", icon: Cpu },
  { label: "ai", value: "assistive systems / review loops", icon: Sparkles }
] as const;
