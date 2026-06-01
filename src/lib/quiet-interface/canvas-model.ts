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

const GLYPHS = [".", ":", "0", "1", "_", "/", "\\", "|", "~", "-"];
const COMMAND_PREFIXES = [
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
  "help",
  "status",
  "look",
  "reset",
  "clear"
];

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function phaseProfile(phase: InterfacePhase): PhaseProfile {
  switch (phase) {
    case "dormant":
      return {
        intensity: 0.2,
        cellAlpha: 0.34,
        filamentAlpha: 0.2,
        noiseAlpha: 0.26,
        apertureScale: 0.82,
        compression: 0.82,
        split: 0
      };
    case "observation":
      return {
        intensity: 0.38,
        cellAlpha: 0.48,
        filamentAlpha: 0.34,
        noiseAlpha: 0.38,
        apertureScale: 0.94,
        compression: 0.9,
        split: 0
      };
    case "assembly":
      return {
        intensity: 0.58,
        cellAlpha: 0.58,
        filamentAlpha: 0.48,
        noiseAlpha: 0.34,
        apertureScale: 1,
        compression: 0.94,
        split: 0.06
      };
    case "boundary":
      return {
        intensity: 0.74,
        cellAlpha: 0.7,
        filamentAlpha: 0.58,
        noiseAlpha: 0.3,
        apertureScale: 1.04,
        compression: 1,
        split: 0.28
      };
    case "inside":
      return {
        intensity: 0.48,
        cellAlpha: 0.42,
        filamentAlpha: 0.32,
        noiseAlpha: 0.16,
        apertureScale: 0.78,
        compression: 0.72,
        split: 0.48
      };
    case "outside":
      return {
        intensity: 0.32,
        cellAlpha: 0.26,
        filamentAlpha: 0.18,
        noiseAlpha: 0.1,
        apertureScale: 0.58,
        compression: 0.58,
        split: 0.72
      };
    default:
      return phaseProfile("dormant");
  }
}

export function paletteForPhase(phase: InterfacePhase) {
  if (phase === "outside") {
    return {
      primary: "rgba(238, 252, 255, 0.86)",
      secondary: "rgba(112, 225, 240, 0.62)",
      low: "rgba(238, 252, 255, 0.14)",
      fill: "rgba(2, 5, 5, 0.34)",
      warning: "rgba(229, 143, 143, 0.62)"
    };
  }

  return {
    primary: "rgba(126, 244, 185, 0.9)",
    secondary: "rgba(75, 214, 240, 0.7)",
    low: "rgba(126, 244, 185, 0.16)",
    fill: "rgba(1, 2, 2, 0.28)",
    warning: "rgba(229, 143, 143, 0.62)"
  };
}

export function commandReactionProfile(event: VisualEvent): { channel: ReactionChannel; strength: number } {
  switch (event) {
    case "error":
      return { channel: "error", strength: 1 };
    case "release":
      return { channel: "release", strength: 1 };
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
    centerX: width * (width < 720 ? 0.58 : 0.68),
    centerY: phase === "outside" ? height * 0.35 : height * 0.42,
    base: Math.min(width, height) * (0.19 + intensity * 0.055) * profile.apertureScale,
    cellSize: width < 720 ? 3 : 4,
    columns: width < 720 ? 34 : 50,
    rows: width < 720 ? 19 : 29
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
  const particleCount = reducedMotion ? 36 : Math.min(112, Math.max(62, Math.floor(area / 13200)));
  const nodeCount = reducedMotion ? 16 : Math.min(32, Math.max(22, Math.floor(area / 36000)));
  const geometry = apparatusGeometry(width, height, "assembly", 52);
  const origin = terminalOrigin(width, height);

  const cells: ApparatusCell[] = [];
  for (let row = 0; row < geometry.rows; row += 1) {
    for (let column = 0; column < geometry.columns; column += 1) {
      const nx = (column - (geometry.columns - 1) / 2) / ((geometry.columns - 1) / 2);
      const ny = (row - (geometry.rows - 1) / 2) / ((geometry.rows - 1) / 2);
      const radius = nx * nx + ny * ny * 1.78;
      const shell = radius > 0.24 && radius < 1.08;
      const corridor = Math.abs(ny) < 0.14 && nx > -0.76 && nx < 0.7;
      const boundary = Math.abs(nx) < 0.12 && Math.abs(ny) < 0.84;
      const core = Math.abs(nx) < 0.09 && Math.abs(ny) < 0.16;

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
    const nearAperture = random() > 0.42;
    const signalBand = random() > 0.72;
    const homeX = signalBand
      ? origin.x + (geometry.centerX - origin.x) * random()
      : nearAperture
        ? geometry.centerX + (random() - 0.5) * geometry.base * 3.2
        : random() * width;
    const homeY = signalBand
      ? origin.y + (geometry.centerY - origin.y) * random() + (random() - 0.5) * 48
      : nearAperture
        ? geometry.centerY + (random() - 0.5) * geometry.base * 1.8
        : random() * height;

    return {
      x: homeX,
      y: homeY,
      vx: (random() - 0.5) * 0.05,
      vy: (random() - 0.5) * 0.05,
      homeX,
      homeY,
      char: GLYPHS[Math.floor(random() * GLYPHS.length)],
      size: 8 + random() * 6,
      alpha: 0.045 + random() * 0.18,
      phase: random() * Math.PI * 2
    };
  });

  const nodes: NodePoint[] = Array.from({ length: nodeCount }, (_, index) => {
    const amount = index / Math.max(1, nodeCount - 1);
    const curve = Math.sin(amount * Math.PI);
    const apertureBias = index % 3 === 0;
    const homeX = apertureBias
      ? geometry.centerX + (random() - 0.5) * geometry.base * 2.4
      : origin.x + (geometry.centerX - origin.x) * amount + (random() - 0.5) * 54 * curve;
    const homeY = apertureBias
      ? geometry.centerY + (random() - 0.5) * geometry.base * 1.4
      : origin.y + (geometry.centerY - origin.y) * amount - curve * 74 + (random() - 0.5) * 34;

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
    const nearest = nodes
      .map((candidate, candidateIndex) => ({
        candidateIndex,
        distance: Math.hypot(candidate.homeX - node.homeX, candidate.homeY - node.homeY)
      }))
      .filter((candidate) => candidate.candidateIndex !== index)
      .sort((first, second) => first.distance - second.distance)
      .slice(0, 2);

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
