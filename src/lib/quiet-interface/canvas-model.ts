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

const GLYPHS = [".", ":", "0", "1", "_", "/", "\\", "|", "~", "-"];

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function phaseIntensity(phase: InterfacePhase) {
  switch (phase) {
    case "dormant":
      return 0.24;
    case "observation":
      return 0.38;
    case "assembly":
      return 0.56;
    case "boundary":
      return 0.72;
    case "inside":
      return 0.5;
    case "outside":
      return 0.34;
    default:
      return 0.24;
  }
}

export function paletteForPhase(phase: InterfacePhase) {
  if (phase === "outside") {
    return {
      primary: "rgba(238, 252, 255, 0.86)",
      secondary: "rgba(112, 225, 240, 0.62)",
      low: "rgba(238, 252, 255, 0.14)",
      fill: "rgba(2, 5, 5, 0.34)"
    };
  }

  return {
    primary: "rgba(126, 244, 185, 0.9)",
    secondary: "rgba(75, 214, 240, 0.7)",
    low: "rgba(126, 244, 185, 0.16)",
    fill: "rgba(1, 2, 2, 0.28)"
  };
}

export function eventPulse(currentEvent: VisualEvent | undefined, event: VisualEvent, pulse: number) {
  return currentEvent === event ? pulse : 0;
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
  const particleCount = reducedMotion ? 48 : Math.min(172, Math.max(84, Math.floor(area / 9000)));
  const nodeCount = reducedMotion ? 18 : Math.min(36, Math.max(22, Math.floor(area / 30000)));
  const apertureX = width * (width < 720 ? 0.56 : 0.67);
  const apertureY = height * 0.42;

  const particles: Particle[] = Array.from({ length: particleCount }, () => {
    const nearAperture = random() > 0.58;
    const spreadX = width * (0.18 + random() * 0.26);
    const spreadY = height * (0.16 + random() * 0.22);
    const homeX = nearAperture ? apertureX + (random() - 0.5) * spreadX : random() * width;
    const homeY = nearAperture ? apertureY + (random() - 0.5) * spreadY : random() * height;

    return {
      x: homeX,
      y: homeY,
      vx: (random() - 0.5) * 0.08,
      vy: (random() - 0.5) * 0.06,
      homeX,
      homeY,
      char: GLYPHS[Math.floor(random() * GLYPHS.length)],
      size: 9 + random() * 7,
      alpha: 0.05 + random() * 0.24,
      phase: random() * Math.PI * 2
    };
  });

  const nodes: NodePoint[] = Array.from({ length: nodeCount }, (_, index) => {
    const ring = index / nodeCount;
    const biased = random() > 0.35;
    const angle = ring * Math.PI * 2 + random() * 0.7;
    const radiusX = Math.min(width, height) * (0.16 + random() * 0.24);
    const radiusY = Math.min(width, height) * (0.1 + random() * 0.19);
    const homeX = biased ? apertureX + Math.cos(angle) * radiusX : width * (0.08 + random() * 0.84);
    const homeY = biased ? apertureY + Math.sin(angle) * radiusY : height * (0.12 + random() * 0.76);

    return {
      x: homeX,
      y: homeY,
      homeX,
      homeY,
      phase: random() * Math.PI * 2,
      weight: 0.4 + random() * 1.2
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
      if (candidate.candidateIndex > index || random() > 0.64) {
        filaments.push({
          from: index,
          to: candidate.candidateIndex,
          offset: random(),
          speed: 0.0018 + random() * 0.0042,
          alpha: 0.08 + random() * 0.18,
          dash: 7 + random() * 18
        });
      }
    });
  });

  return { particles, nodes, filaments };
}
