import { createSeededRandom } from "@/lib/quiet-interface/seeded-random";
import type { InterfacePhase, VisualEvent } from "@/lib/quiet-interface/state";

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  char: string;
  size: number;
  alpha: number;
  phase: number;
};

export type NodePoint = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  phase: number;
  weight: number;
};

export type Filament = {
  from: number;
  to: number;
  offset: number;
  speed: number;
  alpha: number;
  dash: number;
};

export type ApparatusCell = {
  column: number;
  row: number;
  nx: number;
  ny: number;
  shell: boolean;
  corridor: boolean;
  boundary: boolean;
  core: boolean;
  seed: number;
};

export type ApparatusGeometry = {
  centerX: number;
  centerY: number;
  base: number;
  cellSize: number;
  columns: number;
  rows: number;
};

export type ReactionChannel = "typing" | "submit" | "error" | "phase" | "release" | "inspect";

export type ReactionChannels = Record<ReactionChannel, number>;

export type PhaseProfile = {
  intensity: number;
  cellAlpha: number;
  filamentAlpha: number;
  noiseAlpha: number;
  apertureScale: number;
  compression: number;
  split: number;
};

export const EMPTY_REACTIONS: ReactionChannels = {
  typing: 0,
  submit: 0,
  error: 0,
  phase: 0,
  release: 0,
  inspect: 0
};

const GLYPHS = [".", ":", "_", "|", "-"];
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
  "echo",
  "printf",
  "make signal",
  "cd boundary",
  "cd inside",
  "./release",
  "history",
  "clear",
  "reset",
  "wake",
  "listen",
  "trace",
  "scan",
  "classify",
  "align",
  "make signal",
  "open boundary",
  "read",
  "enter",
  "release",
  "contain",
  "contact",
  "whois",
  "outside",
  "status",
  "look"
];

export function phaseProfile(phase: InterfacePhase): PhaseProfile {
  switch (phase) {
    case "dormant":
      return {
        intensity: 0.14,
        cellAlpha: 0.3,
        filamentAlpha: 0.13,
        noiseAlpha: 0.16,
        apertureScale: 0.76,
        compression: 0.78,
        split: 0
      };
    case "observation":
      return {
        intensity: 0.36,
        cellAlpha: 0.52,
        filamentAlpha: 0.3,
        noiseAlpha: 0.28,
        apertureScale: 0.92,
        compression: 0.9,
        split: 0
      };
    case "assembly":
      return {
        intensity: 0.6,
        cellAlpha: 0.64,
        filamentAlpha: 0.5,
        noiseAlpha: 0.24,
        apertureScale: 1,
        compression: 0.94,
        split: 0.06
      };
    case "boundary":
      return {
        intensity: 0.78,
        cellAlpha: 0.76,
        filamentAlpha: 0.58,
        noiseAlpha: 0.18,
        apertureScale: 1.04,
        compression: 1,
        split: 0.28
      };
    case "inside":
      return {
        intensity: 0.42,
        cellAlpha: 0.4,
        filamentAlpha: 0.24,
        noiseAlpha: 0.09,
        apertureScale: 0.74,
        compression: 0.68,
        split: 0.56
      };
    case "outside":
      return {
        intensity: 0.22,
        cellAlpha: 0.18,
        filamentAlpha: 0.1,
        noiseAlpha: 0.04,
        apertureScale: 0.48,
        compression: 0.52,
        split: 0.8
      };
    default:
      return phaseProfile("dormant");
  }
}

export function paletteForPhase(phase: InterfacePhase) {
  if (phase === "outside") {
    return {
      primary: "rgba(230, 238, 233, 0.9)",
      secondary: "rgba(142, 185, 196, 0.66)",
      low: "rgba(230, 238, 233, 0.12)",
      fill: "rgba(2, 7, 5, 0.42)",
      warning: "rgba(207, 133, 133, 0.62)"
    };
  }

  return {
    primary: "rgba(118, 239, 182, 0.88)",
    secondary: "rgba(142, 185, 196, 0.72)",
    low: "rgba(118, 239, 182, 0.13)",
    fill: "rgba(2, 7, 5, 0.34)",
    warning: "rgba(207, 133, 133, 0.62)"
  };
}

export function commandReactionProfile(event: VisualEvent): { channel: ReactionChannel; strength: number } {
  switch (event) {
    case "align-wrong":
    case "error":
      return { channel: "error", strength: 1 };
    case "align-correct":
      return { channel: "phase", strength: 1 };
    case "release":
      return { channel: "release", strength: 1 };
    case "hint":
    case "scan":
    case "inspect":
      return { channel: "inspect", strength: 1 };
    case "reset":
      return { channel: "phase", strength: 0.82 };
    default:
      return { channel: "phase", strength: 1 };
  }
}

export function createReactionChannels(overrides: Partial<ReactionChannels> = {}): ReactionChannels {
  return {
    ...EMPTY_REACTIONS,
    ...overrides
  };
}

export function decayReactions(reactions: ReactionChannels, reducedMotion: boolean): ReactionChannels {
  const decay = reducedMotion
    ? { typing: 0.22, submit: 0.14, error: 0.18, phase: 0.16, release: 0.12, inspect: 0.16 }
    : { typing: 0.075, submit: 0.038, error: 0.055, phase: 0.026, release: 0.018, inspect: 0.05 };

  return {
    typing: Math.max(0, reactions.typing - decay.typing),
    submit: Math.max(0, reactions.submit - decay.submit),
    error: Math.max(0, reactions.error - decay.error),
    phase: Math.max(0, reactions.phase - decay.phase),
    release: Math.max(0, reactions.release - decay.release),
    inspect: Math.max(0, reactions.inspect - decay.inspect)
  };
}

export function apparatusGeometry(width: number, height: number, phase: InterfacePhase, signalLevel: number): ApparatusGeometry {
  const profile = phaseProfile(phase);
  const intensity = Math.min(1, profile.intensity + signalLevel / 220);
  return {
    centerX: width * (width < 1200 ? 0.8 : 0.745),
    centerY: phase === "outside" ? height * 0.43 : height * 0.45,
    base: Math.min(width, height) * (0.19 + intensity * 0.025) * profile.apertureScale,
    cellSize: width < 980 ? 3.4 : 4,
    columns: width < 980 ? 35 : 39,
    rows: width < 980 ? 39 : 43
  };
}

export function terminalOrigin(width: number, height: number) {
  return {
    x: width < 720 ? width * 0.1 : width * 0.13,
    y: width < 720 ? height * 0.86 : height * 0.78
  };
}

export function inputFingerprint(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function prefixStrength(input: string) {
  const normalized = input.trim().toLowerCase().replace(/^\/+/, "");
  if (!normalized) {
    return 0;
  }

  const match = COMMAND_PREFIXES.find((command) => command.startsWith(normalized) || normalized.startsWith(command));
  if (!match) {
    return 0.18;
  }

  return Math.min(1, 0.35 + normalized.length / Math.max(match.length, 1));
}

export function createVisualField({
  width,
  height,
  reducedMotion
}: {
  width: number;
  height: number;
  reducedMotion: boolean;
}) {
  const random = createSeededRandom(8271979 + Math.floor(width * 17) + Math.floor(height * 31));
  const area = width * height;
  const particleCount = reducedMotion ? 16 : Math.min(48, Math.max(26, Math.floor(area / 30000)));
  const nodeCount = reducedMotion ? 12 : Math.min(22, Math.max(16, Math.floor(area / 62000)));
  const geometry = apparatusGeometry(width, height, "assembly", 52);
  const origin = terminalOrigin(width, height);

  const cells: ApparatusCell[] = [];
  for (let row = 0; row < geometry.rows; row += 1) {
    for (let column = 0; column < geometry.columns; column += 1) {
      const nx = (column - (geometry.columns - 1) / 2) / ((geometry.columns - 1) / 2);
      const ny = (row - (geometry.rows - 1) / 2) / ((geometry.rows - 1) / 2);
      const absoluteX = Math.abs(nx);
      const absoluteY = Math.abs(ny);
      const outer = absoluteX <= 0.88 && absoluteY <= 0.96 && absoluteX + absoluteY <= 1.48;
      const inner = absoluteX < 0.62 && absoluteY < 0.72 && absoluteX + absoluteY < 1.08;
      const shell = outer && !inner;
      const corridor = absoluteY < 0.045 && absoluteX < 0.64;
      const boundary = absoluteX < 0.045 && absoluteY < 0.72;
      const core = absoluteX + absoluteY < 0.14;

      if (shell || corridor || boundary || core) {
        cells.push({
          column,
          row,
          nx,
          ny,
          shell,
          corridor,
          boundary,
          core,
          seed: random()
        });
      }
    }
  }

  const particles: Particle[] = Array.from({ length: particleCount }, () => {
    const nearAperture = random() > 0.2;
    const signalBand = random() > 0.48;
    const homeX = signalBand
      ? origin.x + (geometry.centerX - origin.x) * random()
      : nearAperture
        ? geometry.centerX + (random() - 0.5) * geometry.base * 2.7
        : geometry.centerX + (random() - 0.5) * geometry.base * 3.6;
    const homeY = signalBand
      ? origin.y + (geometry.centerY - origin.y) * random() + (random() - 0.5) * 48
      : nearAperture
        ? geometry.centerY + (random() - 0.5) * geometry.base * 2.4
        : geometry.centerY + (random() - 0.5) * geometry.base * 3;

    return {
      x: homeX,
      y: homeY,
      vx: (random() - 0.5) * 0.05,
      vy: (random() - 0.5) * 0.05,
      homeX,
      homeY,
      char: GLYPHS[Math.floor(random() * GLYPHS.length)],
      size: 6 + random() * 3,
      alpha: 0.024 + random() * 0.09,
      phase: random() * Math.PI * 2
    };
  });

  const nodes: NodePoint[] = Array.from({ length: nodeCount }, (_, index) => {
    const pathNodeCount = Math.min(7, nodeCount);
    const onSignalPath = index < pathNodeCount;
    const amount = onSignalPath ? index / Math.max(1, pathNodeCount - 1) : (index - pathNodeCount) / Math.max(1, nodeCount - pathNodeCount);
    const curve = Math.sin(amount * Math.PI);
    const orbit = amount * Math.PI * 2 + random() * 0.18;
    const homeX = onSignalPath
      ? origin.x + (geometry.centerX - geometry.base * 0.7 - origin.x) * amount + (random() - 0.5) * 22 * curve
      : geometry.centerX + Math.cos(orbit) * geometry.base * (0.86 + random() * 0.34);
    const homeY = onSignalPath
      ? origin.y + (geometry.centerY - origin.y) * amount - curve * 52 + (random() - 0.5) * 16
      : geometry.centerY + Math.sin(orbit) * geometry.base * (1.02 + random() * 0.26);

    return {
      x: homeX,
      y: homeY,
      homeX,
      homeY,
      phase: random() * Math.PI * 2,
      weight: 0.45 + random() * 1.1
    };
  });

  const filaments: Filament[] = [];
  nodes.forEach((node, index) => {
    const distances: Array<{ candidateIndex: number; distance: number }> = [];
    nodes.forEach((candidate, candidateIndex) => {
      if (candidateIndex !== index) {
        distances.push({
          candidateIndex,
          distance: Math.hypot(candidate.homeX - node.homeX, candidate.homeY - node.homeY)
        });
      }
    });
    const nearest = distances.sort((first, second) => first.distance - second.distance).slice(0, 2);

    nearest.forEach((candidate) => {
      if (candidate.candidateIndex > index || random() > 0.68) {
        filaments.push({
          from: index,
          to: candidate.candidateIndex,
          offset: random(),
          speed: 0.002 + random() * 0.004,
          alpha: 0.08 + random() * 0.16,
          dash: 7 + random() * 18
        });
      }
    });
  });

  return { particles, nodes, filaments, cells };
}
