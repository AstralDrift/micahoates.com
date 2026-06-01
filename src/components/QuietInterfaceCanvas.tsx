"use client";

import { useEffect, useRef } from "react";

import { createSeededRandom, lerp } from "@/lib/quiet-interface/seeded-random";
import type { InterfacePhase, VisualEvent } from "@/lib/quiet-interface/state";

type QuietInterfaceCanvasProps = {
  phase: InterfacePhase;
  signalLevel: number;
  visualEvent?: VisualEvent;
  pointer: { x: number; y: number; active: boolean };
};

type Particle = {
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

type NodePoint = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  phase: number;
  weight: number;
};

type Filament = {
  from: number;
  to: number;
  offset: number;
  speed: number;
  alpha: number;
  dash: number;
};

const GLYPHS = [".", ":", "0", "1", "_", "/", "\\", "|", "~", "-"];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function phaseIntensity(phase: InterfacePhase) {
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

function paletteForPhase(phase: InterfacePhase) {
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

function eventPulse(currentEvent: VisualEvent | undefined, event: VisualEvent, pulse: number) {
  return currentEvent === event ? pulse : 0;
}

export function QuietInterfaceCanvas({ phase, signalLevel, visualEvent, pointer }: QuietInterfaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef({
    phase,
    signalLevel,
    visualEvent,
    pointer,
    pulse: 0
  });

  useEffect(() => {
    runtimeRef.current.phase = phase;
    runtimeRef.current.signalLevel = signalLevel;
    runtimeRef.current.pointer = pointer;
  }, [phase, pointer, signalLevel]);

  useEffect(() => {
    runtimeRef.current.visualEvent = visualEvent;
    if (visualEvent) {
      runtimeRef.current.pulse = visualEvent === "error" ? 0.5 : 1;
    }
  }, [visualEvent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      return;
    }

    const reducedMotion = prefersReducedMotion();
    let width = 0;
    let height = 0;
    let ratio = 1;
    let animationFrame = 0;
    let frame = 0;
    let particles: Particle[] = [];
    let nodes: NodePoint[] = [];
    let filaments: Filament[] = [];

    const buildField = () => {
      const random = createSeededRandom(8271979 + Math.floor(width * 17) + Math.floor(height * 31));
      const area = width * height;
      const particleCount = reducedMotion ? 48 : Math.min(172, Math.max(84, Math.floor(area / 9000)));
      const nodeCount = reducedMotion ? 18 : Math.min(36, Math.max(22, Math.floor(area / 30000)));
      const apertureX = width * (width < 720 ? 0.56 : 0.67);
      const apertureY = height * 0.42;

      particles = Array.from({ length: particleCount }, () => {
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

      nodes = Array.from({ length: nodeCount }, (_, index) => {
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

      filaments = [];
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
    };

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = "#020302";
      context.fillRect(0, 0, width, height);
      buildField();
    };

    const drawGrid = (intensity: number, pulse: number) => {
      const state = runtimeRef.current;
      const reduction = state.phase === "inside" ? 0.72 : state.phase === "outside" ? 0.48 : 1;

      context.save();
      context.lineWidth = 1;
      context.strokeStyle = "rgba(180, 255, 215, 0.1)";

      const gap = width < 720 ? 32 : 42;
      const drift = reducedMotion ? 0 : (frame * 0.06) % gap;
      context.globalAlpha = (0.08 + intensity * 0.1 + pulse * 0.04) * reduction;

      for (let x = -gap + drift; x < width + gap; x += gap) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }

      context.globalAlpha = (0.045 + intensity * 0.06) * reduction;
      for (let y = gap * 0.5; y < height; y += gap) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      context.globalAlpha = (0.018 + intensity * 0.016) * reduction;
      context.fillStyle = "rgba(180, 255, 215, 0.1)";
      for (let y = 0; y < height; y += 3) {
        context.fillRect(0, y, width, 1);
      }

      context.restore();
    };

    const drawAperture = (intensity: number, pulse: number) => {
      const state = runtimeRef.current;
      const palette = paletteForPhase(state.phase);
      const centerX = width * (width < 720 ? 0.56 : 0.67);
      const centerY = state.phase === "outside" ? height * 0.36 : height * 0.42;
      const wakeBoost = eventPulse(state.visualEvent, "wake", pulse);
      const signalBoost = eventPulse(state.visualEvent, "make-signal", pulse);
      const boundaryBoost = eventPulse(state.visualEvent, "boundary", pulse);
      const enterBoost = eventPulse(state.visualEvent, "enter", pulse);
      const releaseBoost = eventPulse(state.visualEvent, "release", pulse);
      const phaseScale = state.phase === "dormant" ? 0.72 : state.phase === "inside" ? 0.78 : state.phase === "outside" ? 0.56 : 1;
      const base = Math.min(width, height) * (0.16 + intensity * 0.065) * (phaseScale + wakeBoost * 0.18 + boundaryBoost * 0.12);
      const ringCount = reducedMotion ? 4 : 7;
      const eventLift = wakeBoost * 0.28 + signalBoost * 0.2 + boundaryBoost * 0.34 - releaseBoost * 0.08;
      const surfaceOpen = boundaryBoost > 0.04 || state.phase === "inside" || state.phase === "outside";

      context.save();
      context.lineWidth = 1;
      context.shadowColor = state.phase === "outside" ? "rgba(238, 252, 255, 0.22)" : "rgba(105, 245, 185, 0.2)";
      context.shadowBlur = 8 + pulse * 18;

      for (let ring = 0; ring < ringCount; ring += 1) {
        const rx = base * (0.52 + ring * 0.17 + eventLift);
        const ry = base * (0.22 + ring * 0.1 + eventLift * 0.32);
        const segments = 28 + ring * 5;
        const rotation = (reducedMotion ? 0 : frame * (0.0018 + ring * 0.00034)) + ring * 0.27;

        context.strokeStyle = ring % 2 === 0 ? palette.primary : palette.secondary;
        context.globalAlpha = Math.max(0.045, 0.1 + intensity * 0.14 - ring * 0.012 + pulse * 0.12 - enterBoost * 0.05);

        for (let segment = 0; segment < segments; segment += 1) {
          if ((segment + ring) % 5 === 0 && state.phase === "dormant") {
            continue;
          }

          const start = rotation + (segment / segments) * Math.PI * 2;
          const end = start + (Math.PI * 2) / segments * (0.34 + ((segment + ring) % 3) * 0.12);
          const x1 = centerX + Math.cos(start) * rx;
          const y1 = centerY + Math.sin(start) * ry;
          const x2 = centerX + Math.cos(end) * rx;
          const y2 = centerY + Math.sin(end) * ry;

          context.beginPath();
          context.moveTo(x1, y1);
          context.lineTo(x2, y2);
          context.stroke();
        }
      }

      const cellSize = width < 720 ? 3 : 4;
      const columns = width < 720 ? 24 : 38;
      const rows = width < 720 ? 14 : 22;

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const nx = (column - (columns - 1) / 2) / ((columns - 1) / 2);
          const ny = (row - (rows - 1) / 2) / ((rows - 1) / 2);
          const radius = nx * nx + ny * ny * 1.92;
          const shell = radius > 0.3 && radius < 1.08;
          const corridor = Math.abs(ny) < 0.18 && nx > -0.72 && nx < 0.64;
          const openSlot = surfaceOpen && Math.abs(nx) < 0.16 && Math.abs(ny) < 0.74;
          const shimmer = Math.sin(frame * 0.032 + column * 0.74 + row * 0.58);
          const brokenMask = Math.sin(column * 1.71 + row * 2.19) > -0.48;

          if (openSlot) {
            continue;
          }

          if (!shell && !corridor) {
            continue;
          }

          if (!brokenMask && shimmer < 0.62 && state.phase === "dormant") {
            continue;
          }

          const x = centerX + nx * base * 1.45;
          const y = centerY + ny * base * 0.92;
          const lit = Math.max(0, shimmer) * 0.07;
          context.globalAlpha = Math.min(0.7, 0.08 + intensity * 0.22 + pulse * 0.16 + signalBoost * 0.18 + boundaryBoost * 0.12 + lit);
          context.fillStyle = corridor || (column + row) % 5 === 0 ? palette.secondary : palette.primary;
          const size = cellSize + signalBoost * 1.2 + boundaryBoost * 0.8;
          context.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }

      const sweepCount = reducedMotion ? 1 : 3;
      for (let index = 0; index < sweepCount; index += 1) {
        const angle = (frame * 0.006 + index * (Math.PI * 2) / sweepCount) % (Math.PI * 2);
        const length = base * (1.15 + intensity * 0.7);
        context.globalAlpha = 0.035 + intensity * 0.055 + pulse * 0.08;
        context.strokeStyle = index % 2 === 0 ? palette.secondary : palette.low;
        context.beginPath();
        context.moveTo(centerX, centerY);
        context.lineTo(centerX + Math.cos(angle) * length, centerY + Math.sin(angle) * length * 0.58);
        context.stroke();
      }

      const chordCount = reducedMotion ? 4 : 10;
      for (let index = 0; index < chordCount; index += 1) {
        const amount = index / (chordCount - 1);
        const y = centerY + lerp(-base * 0.48, base * 0.48, amount);
        const chord = Math.cos((amount - 0.5) * Math.PI) * base * (0.72 + intensity * 0.45);
        const drift = reducedMotion ? 0 : Math.sin(frame * 0.012 + index) * 8;

        context.globalAlpha = 0.04 + intensity * 0.09 + pulse * 0.08;
        context.strokeStyle = index % 2 === 0 ? palette.low : palette.secondary;
        context.beginPath();
        context.moveTo(centerX - chord + drift, y);
        context.lineTo(centerX + chord * 0.62 + drift, y + Math.sin(index) * 4);
        context.stroke();
      }

      context.globalAlpha = 0.08 + intensity * 0.14 + pulse * 0.16;
      context.strokeStyle = palette.primary;
      context.strokeRect(centerX - base * 0.13, centerY - base * 0.13, base * 0.26, base * 0.26);

      if (surfaceOpen) {
        context.globalAlpha = 0.12 + intensity * 0.18 + boundaryBoost * 0.2;
        context.strokeStyle = state.phase === "outside" ? palette.primary : palette.secondary;
        context.beginPath();
        context.moveTo(centerX, centerY - base * (0.62 + boundaryBoost * 0.2));
        context.lineTo(centerX, centerY + base * (0.62 + boundaryBoost * 0.2));
        context.stroke();
      }

      context.restore();
    };

    const drawFilaments = (intensity: number, pulse: number) => {
      const state = runtimeRef.current;
      const palette = paletteForPhase(state.phase);
      const listenBoost = eventPulse(state.visualEvent, "listen", pulse);
      const traceBoost = eventPulse(state.visualEvent, "trace", pulse);
      const phaseReduction = state.phase === "inside" ? 0.72 : state.phase === "outside" ? 0.46 : 1;

      nodes.forEach((node) => {
        const movement = reducedMotion ? 0 : 1;
        const xSway = Math.sin(frame * 0.006 + node.phase) * 5 * node.weight * movement;
        const ySway = Math.cos(frame * 0.004 + node.phase) * 4 * node.weight * movement;
        const pointerPull = state.pointer.active ? Math.max(0, 1 - Math.hypot(node.homeX - state.pointer.x, node.homeY - state.pointer.y) / 240) : 0;

        node.x = node.homeX + xSway + (node.homeX - state.pointer.x) * pointerPull * 0.026;
        node.y = node.homeY + ySway + (node.homeY - state.pointer.y) * pointerPull * 0.026;
      });

      context.save();
      context.lineWidth = 1;
      context.lineCap = "round";

      filaments.forEach((filament, index) => {
        const from = nodes[filament.from];
        const to = nodes[filament.to];
        if (!from || !to) {
          return;
        }

        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const visibleDistance = Math.min(width, height) * (0.18 + intensity * 0.48 + traceBoost * 0.2);
        if (distance > visibleDistance && state.phase === "dormant") {
          return;
        }

        const alpha = (filament.alpha + intensity * 0.12 + pulse * 0.08 + traceBoost * 0.22 + listenBoost * 0.08) * phaseReduction;
        context.globalAlpha = Math.min(0.42, alpha);
        context.strokeStyle = index % 3 === 0 ? palette.secondary : palette.low;
        context.setLineDash([filament.dash, filament.dash * 1.9]);
        context.lineDashOffset = reducedMotion ? 0 : -frame * (0.05 + filament.speed * 16);
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();

        if (!reducedMotion) {
          const progress = (frame * filament.speed + filament.offset + pulse * 0.18) % 1;
          const pulseX = lerp(from.x, to.x, progress);
          const pulseY = lerp(from.y, to.y, progress);
          context.globalAlpha = Math.min(0.9, (0.2 + intensity * 0.4 + pulse * 0.35 + traceBoost * 0.28) * phaseReduction);
          context.fillStyle = index % 3 === 0 ? palette.secondary : palette.primary;
          context.beginPath();
          context.arc(pulseX, pulseY, 1.1 + pulse * 1.8, 0, Math.PI * 2);
          context.fill();
        }
      });

      context.setLineDash([]);
      nodes.forEach((node, index) => {
        if (index % 3 !== 0 && runtimeRef.current.phase === "dormant") {
          return;
        }

        context.globalAlpha = (0.08 + intensity * 0.18 + pulse * 0.12 + listenBoost * 0.1) * phaseReduction;
        context.fillStyle = index % 2 === 0 ? palette.primary : palette.secondary;
        context.fillRect(node.x - 1, node.y - 1, 2, 2);
      });
      context.restore();
    };

    const drawParticles = (intensity: number, pulse: number) => {
      const state = runtimeRef.current;
      const palette = paletteForPhase(state.phase);
      const apertureX = width * (width < 720 ? 0.56 : 0.67);
      const apertureY = state.phase === "outside" ? height * 0.36 : height * 0.42;
      const coherence = Math.min(1, state.signalLevel / 100);
      const listenBoost = eventPulse(state.visualEvent, "listen", pulse);
      const releaseBoost = eventPulse(state.visualEvent, "release", pulse);
      const phaseReduction = state.phase === "inside" ? 0.62 : state.phase === "outside" ? 0.34 : state.phase === "dormant" ? 0.72 : 1;

      context.save();
      context.textBaseline = "middle";
      context.textAlign = "center";

      particles.forEach((particle, index) => {
        const orbit = particle.phase + frame * (0.001 + (index % 7) * 0.00018);
        const orbitX = apertureX + Math.cos(orbit) * Math.min(width, height) * (0.12 + (index % 5) * 0.022);
        const orbitY = apertureY + Math.sin(orbit) * Math.min(width, height) * (0.07 + (index % 4) * 0.018);
        const targetX = lerp(particle.homeX, orbitX, coherence * (0.34 + intensity * 0.18));
        const targetY = lerp(particle.homeY, orbitY, coherence * (0.34 + intensity * 0.18));
        const pointerPush = state.pointer.active ? Math.max(0, 1 - Math.hypot(particle.x - state.pointer.x, particle.y - state.pointer.y) / 170) : 0;
        const pushX = pointerPush > 0 ? (particle.x - state.pointer.x) * pointerPush * 0.004 : 0;
        const pushY = pointerPush > 0 ? (particle.y - state.pointer.y) * pointerPush * 0.004 : 0;

        if (!reducedMotion) {
          particle.vx = particle.vx * 0.94 + (targetX - particle.x) * 0.0015 + pushX;
          particle.vy = particle.vy * 0.94 + (targetY - particle.y) * 0.0015 + pushY;
          particle.x += particle.vx + Math.sin(frame * 0.014 + particle.phase) * 0.05;
          particle.y += particle.vy + Math.cos(frame * 0.011 + particle.phase) * 0.04;
        }

        if (particle.x < -28) particle.x = width + 28;
        if (particle.x > width + 28) particle.x = -28;
        if (particle.y < -28) particle.y = height + 28;
        if (particle.y > height + 28) particle.y = -28;

        const flicker = reducedMotion ? 0 : Math.sin(frame * 0.04 + particle.phase) * 0.04;
        const alpha = Math.min(0.76, (particle.alpha + intensity * 0.22 + pulse * 0.16 + listenBoost * 0.24 + pointerPush * 0.18 + flicker) * phaseReduction + releaseBoost * 0.08);
        context.globalAlpha = Math.max(0.025, alpha);
        context.fillStyle = index % 9 === 0 ? palette.secondary : palette.primary;
        context.font = `${particle.size}px SFMono-Regular, ui-monospace, monospace`;
        context.fillText(particle.char, particle.x, particle.y);
      });

      context.restore();
    };

    const drawCursorBody = (intensity: number, pulse: number) => {
      const state = runtimeRef.current;
      const palette = paletteForPhase(state.phase);
      const cursorX = lerp(width * 0.12, width * 0.74, Math.min(1, state.signalLevel / 100));
      const cursorY = state.phase === "outside" ? height * 0.25 : height * 0.75;
      const blink = reducedMotion ? 0.4 : 0.45 + Math.sin(frame * 0.08) * 0.22;

      context.save();
      context.globalAlpha = blink + pulse * 0.35;
      context.fillStyle = palette.primary;
      context.shadowColor = palette.primary;
      context.shadowBlur = 10 + pulse * 18;
      context.fillRect(cursorX, cursorY, 7, 18);

      context.globalAlpha = 0.08 + intensity * 0.13 + pulse * 0.08;
      context.strokeStyle = palette.secondary;
      context.beginPath();
      context.moveTo(width * 0.1, cursorY + 9);
      context.lineTo(cursorX - 18, cursorY + 9);
      context.stroke();
      context.restore();
    };

    const drawEventSweep = (intensity: number, pulse: number) => {
      if (pulse <= 0.01) {
        return;
      }

      const state = runtimeRef.current;
      const palette = paletteForPhase(state.phase);
      const wakeBoost = eventPulse(state.visualEvent, "wake", pulse);
      const releaseBoost = eventPulse(state.visualEvent, "release", pulse);
      const errorBoost = eventPulse(state.visualEvent, "error", pulse);
      const sweepY = wakeBoost > 0 ? height * (1 - wakeBoost) : height * (0.2 + pulse * 0.58);
      const sweepX = width * (0.18 + Math.min(1, state.signalLevel / 100) * 0.52);

      context.save();
      context.globalAlpha = Math.min(0.72, 0.08 + intensity * 0.16 + pulse * 0.28);
      context.strokeStyle = errorBoost > 0 ? "rgba(229, 143, 143, 0.58)" : releaseBoost > 0 ? palette.primary : palette.secondary;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(width * 0.06, sweepY);
      context.lineTo(width * 0.94, sweepY);
      context.stroke();

      context.globalAlpha = Math.min(0.58, 0.06 + pulse * 0.22);
      context.beginPath();
      context.moveTo(sweepX, height * 0.1);
      context.lineTo(sweepX, height * 0.9);
      context.stroke();
      context.restore();
    };

    const draw = () => {
      frame += 1;
      const state = runtimeRef.current;
      const intensity = Math.min(1, phaseIntensity(state.phase) + state.signalLevel / 210);
      const pulse = state.pulse;
      const palette = paletteForPhase(state.phase);

      context.fillStyle = palette.fill;
      context.fillRect(0, 0, width, height);

      drawGrid(intensity, pulse);
      drawFilaments(intensity, pulse);
      drawAperture(intensity, pulse);
      drawParticles(intensity, pulse);
      drawCursorBody(intensity, pulse);
      drawEventSweep(intensity, pulse);

      state.pulse = Math.max(0, state.pulse - (reducedMotion ? 0.08 : 0.016));
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="quiet-canvas" aria-hidden="true" />;
}
