import { createSeededRandom } from "@/lib/quiet-interface/seeded-random";
import type { InterfacePhase, VisualEvent } from "@/lib/quiet-interface/state";

export type FieldPoint = {
  x: number;
  y: number;
  size: number;
  alpha: number;
};

export type FieldLine = {
  from: number;
  to: number;
  alpha: number;
};

export type StaticField = {
  points: FieldPoint[];
  lines: FieldLine[];
};

export type SceneLayout = {
  centerX: number;
  centerY: number;
  scale: number;
  mobile: boolean;
};

export type EventEnvelope = {
  progress: number;
  pulse: number;
  active: boolean;
};

export const VISUAL_EVENT_DURATIONS_MS: Readonly<Record<VisualEvent, number>> = {
  boot: 700,
  "carrier-inspect": 420,
  "trace-inspect": 480,
  "signal-lock": 500,
  "signal-error": 420,
  "image-build": 1_100,
  "image-verify": 800,
  mount: 1_400,
  hint: 360,
  inspect: 360,
  enter: 900,
  release: 1_800,
  error: 380,
  reset: 480
};

const MILESTONE_EVENTS = new Set<VisualEvent>([
  "boot",
  "signal-lock",
  "image-build",
  "image-verify",
  "mount",
  "enter",
  "release"
]);

const COMMAND_PREFIXES = [
  "help",
  "man",
  "pwd",
  "ls",
  "tree",
  "find",
  "file",
  "cat",
  "less",
  "more",
  "strings",
  "grep",
  "readlink",
  "journalctl -u interface",
  "systemctl start interface",
  "systemctl status interface",
  "echo lumen > signal",
  "printf lumen > signal",
  "make signal",
  "sha256sum boundary.img",
  "sha256sum -c boundary.img.sha256",
  "mount -o ro boundary.img /mnt/boundary",
  "cd /mnt/boundary/inside",
  "./release",
  "xxd -r -p .afterimage",
  "history",
  "clear",
  "reset",
  "contact",
  "whois",
  "outside"
] as const;

export function milestoneDuration(event: VisualEvent | undefined): number {
  return event && MILESTONE_EVENTS.has(event) ? VISUAL_EVENT_DURATIONS_MS[event] : 0;
}

export function eventEnvelope(elapsedMs: number, durationMs: number, settled: boolean): EventEnvelope {
  if (settled || durationMs <= 0) return { progress: 1, pulse: 0, active: false };
  const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
  return {
    progress,
    pulse: Math.sin(progress * Math.PI),
    active: progress < 1
  };
}

export function sceneLayout(width: number, height: number, mobile: boolean): SceneLayout {
  return mobile
    ? {
        centerX: width * 0.5,
        centerY: Math.min(height * 0.26, 210),
        scale: Math.min(width * 0.34, height * 0.18, 145),
        mobile
      }
    : {
        centerX: width * (width < 1200 ? 0.76 : 0.745),
        centerY: height * 0.47,
        scale: Math.min(width * 0.2, height * 0.32, 280),
        mobile
      };
}

export function inputFingerprint(input: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

export function prefixStrength(input: string): number {
  const normalized = input.trim().toLowerCase().replace(/^\/+/, "");
  if (!normalized) return 0;
  const match = COMMAND_PREFIXES.find((command) => command.startsWith(normalized) || normalized.startsWith(command));
  if (!match) return 0.12;
  return Math.min(1, 0.36 + normalized.length / Math.max(match.length, 1));
}

export function signalTokenInput(input: string): string {
  const normalized = input.trim().toLowerCase();
  const redirect = normalized.match(/^(?:echo|printf)\s+([^\s>]*)/);
  return redirect?.[1] ?? "";
}

export function matchingTokenCharacters(input: string, target: string): number {
  let matched = 0;
  for (let index = 0; index < Math.min(input.length, target.length); index += 1) {
    if (input[index] !== target[index]) break;
    matched += 1;
  }
  return matched;
}

export function createStaticField({ width, height, mobile }: { width: number; height: number; mobile: boolean }): StaticField {
  const random = createSeededRandom(8_271_979 + Math.floor(width * 17) + Math.floor(height * 31));
  const pointCount = mobile ? 22 : Math.min(68, Math.max(38, Math.floor((width * height) / 22_000)));
  const points = Array.from({ length: pointCount }, () => ({
    x: random() * width,
    y: random() * height,
    size: random() > 0.86 ? 2 : 1,
    alpha: 0.08 + random() * 0.22
  }));
  const lines: FieldLine[] = [];
  const connectionLimit = mobile ? 10 : 28;
  for (let index = 0; index < connectionLimit; index += 1) {
    const from = Math.floor(random() * points.length);
    const to = Math.floor(random() * points.length);
    if (from !== to) lines.push({ from, to, alpha: 0.03 + random() * 0.07 });
  }
  return { points, lines };
}

export function phaseEnergy(phase: InterfacePhase): number {
  const energy: Record<InterfacePhase, number> = {
    dormant: 0.16,
    observing: 0.3,
    decoding: 0.48,
    "signal-locked": 0.62,
    "image-built": 0.7,
    "image-verified": 0.8,
    mounted: 0.92,
    inside: 0.76,
    outside: 0.38
  };
  return energy[phase];
}
