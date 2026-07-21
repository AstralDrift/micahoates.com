"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import {
  apparatusGeometry,
  commandReactionProfile,
  createReactionChannels,
  createVisualField,
  decayReactions,
  inputFingerprint,
  paletteForPhase,
  phaseProfile,
  prefixStrength,
  terminalOrigin,
  type ApparatusCell,
  type Filament,
  type NodePoint,
  type Particle,
  type ReactionChannel,
  type ReactionChannels
} from "@/lib/quiet-interface/canvas-model";
import { lerp } from "@/lib/quiet-interface/seeded-random";
import type { InterfacePhase, QuietInterfaceState, TerminalSignal, VisualEvent } from "@/lib/quiet-interface/state";

type SignalPuzzleVisualState = Pick<
  QuietInterfaceState,
  | "signalSlots"
  | "traceOrder"
  | "signalToken"
  | "hasListened"
  | "hasTraced"
  | "hasDecodedSignal"
  | "usedReadHint"
  | "alignAttempts"
  | "perfectRunEligible"
  | "hasMadeSignal"
  | "boundaryOpen"
>;

type QuietInterfaceCanvasProps = {
  phase: InterfacePhase;
  signalLevel: number;
  puzzle: SignalPuzzleVisualState;
  terminalSignalRef: RefObject<TerminalSignal>;
  visualEvent?: VisualEvent;
  visualEventNonce: number;
  terminalAnchor: { x: number; y: number };
};

type RuntimeState = {
  phase: InterfacePhase;
  signalLevel: number;
  puzzle: SignalPuzzleVisualState;
  terminalSignal: TerminalSignal;
  visualEvent?: VisualEvent;
  visualEventNonce: number;
  terminalAnchor: { x: number; y: number };
  pointer: { x: number; y: number; active: boolean };
  reactions: ReactionChannels;
  lastSignalNonce: number;
  lastVisualEventNonce: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const SIGNAL_SLOT_POSITIONS = [
  { x: -0.92, y: -0.62 },
  { x: -0.18, y: -1.02 },
  { x: 0.94, y: -0.42 },
  { x: 0.82, y: 0.7 },
  { x: -0.58, y: 1.02 }
];

function boost(reactions: ReactionChannels, channel: ReactionChannel, strength: number) {
  reactions[channel] = Math.max(reactions[channel], strength);
}

function mergeBoosts(reactions: ReactionChannels, boosts: Partial<ReactionChannels>) {
  Object.entries(boosts).forEach(([channel, strength]) => {
    boost(reactions, channel as ReactionChannel, strength ?? 0);
  });
}

function signalInput(signal: TerminalSignal) {
  return signal.input || signal.submittedCommand || "";
}

function signalTokenInput(input: string) {
  const normalized = input.trim().toLowerCase().replace(/^\/+/, "");
  if (normalized.startsWith("align")) {
    return normalized.slice("align".length).trim();
  }

  const redirectMatch = normalized.match(/^(?:echo|printf)\s+([^\s>]*)/);
  return redirectMatch?.[1] ?? "";
}

function tokenPrefixMatch(token: string, target: string) {
  if (!token) {
    return 0;
  }

  let matched = 0;
  for (let index = 0; index < Math.min(token.length, target.length); index += 1) {
    if (token[index] !== target[index]) {
      break;
    }
    matched += 1;
  }

  return matched / target.length;
}

export function QuietInterfaceCanvas({
  phase,
  signalLevel,
  puzzle,
  terminalSignalRef,
  visualEvent,
  visualEventNonce,
  terminalAnchor
}: QuietInterfaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<RuntimeState>({
    phase,
    signalLevel,
    puzzle,
    terminalSignal: { input: "", event: "idle", nonce: 0 },
    visualEvent,
    visualEventNonce,
    terminalAnchor,
    pointer: { x: 0, y: 0, active: false },
    reactions: createReactionChannels(),
    lastSignalNonce: 0,
    lastVisualEventNonce: visualEventNonce
  });

  useEffect(() => {
    runtimeRef.current.phase = phase;
    runtimeRef.current.signalLevel = signalLevel;
    runtimeRef.current.puzzle = puzzle;
    runtimeRef.current.terminalAnchor = terminalAnchor;
  }, [phase, puzzle, signalLevel, terminalAnchor]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    runtime.visualEvent = visualEvent;
    runtime.visualEventNonce = visualEventNonce;

    if (visualEvent && visualEventNonce !== runtime.lastVisualEventNonce) {
      runtime.lastVisualEventNonce = visualEventNonce;
      const reaction = commandReactionProfile(visualEvent);
      boost(runtime.reactions, reaction.channel, reaction.strength);
    }
  }, [visualEvent, visualEventNonce]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      return;
    }

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionPreference.matches;
    canvas.dataset.motion = reducedMotion ? "reduced" : "full";
    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    let animationFrame = 0;
    let resizeFrame = 0;
    let lastDrawTime = 0;
    let pageVisible = document.visibilityState === "visible";
    const mobileSurface = window.matchMedia("(max-width: 960px)");
    let surfaceEnabled = !mobileSurface.matches;
    let particles: Particle[] = [];
    let nodes: NodePoint[] = [];
    let filaments: Filament[] = [];
    let cells: ApparatusCell[] = [];

    const buildField = () => {
      const field = createVisualField({ width, height, reducedMotion });
      particles = field.particles;
      nodes = field.nodes;
      filaments = field.filaments;
      cells = field.cells;
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
      context.fillStyle = "#020705";
      context.fillRect(0, 0, width, height);
      buildField();
    };

    const scheduleResize = () => {
      if (!surfaceEnabled) {
        return;
      }
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(resize);
    };

    const currentTerminalOrigin = () => {
      const anchor = runtimeRef.current.terminalAnchor;
      if (anchor.x > 0 && anchor.x <= width && anchor.y > 0 && anchor.y <= height) {
        return anchor;
      }
      return terminalOrigin(width, height);
    };

    const eventAmount = (event: VisualEvent, channel: ReactionChannel = "phase") => {
      const state = runtimeRef.current;
      return state.visualEvent === event ? state.reactions[channel] : 0;
    };

    const consumeTerminalSignal = () => {
      const runtime = runtimeRef.current;
      const terminalSignal = terminalSignalRef.current;

      if (terminalSignal.nonce === runtime.lastSignalNonce) {
        return;
      }

      runtime.lastSignalNonce = terminalSignal.nonce;
      runtime.terminalSignal = terminalSignal;

      switch (terminalSignal.event) {
        case "input":
          mergeBoosts(runtime.reactions, { typing: 0.92 });
          break;
        case "autocomplete":
        case "history":
          mergeBoosts(runtime.reactions, { typing: 0.72, phase: 0.28 });
          break;
        case "submit":
        case "palette":
          mergeBoosts(runtime.reactions, { submit: 1, typing: 0.46 });
          break;
        case "clear":
        case "reset":
          mergeBoosts(runtime.reactions, { phase: 0.74 });
          break;
        default:
          break;
      }
    };

    const drawBaseField = () => {
      const state = runtimeRef.current;
      const profile = phaseProfile(state.phase);
      const palette = paletteForPhase(state.phase);
      const reduction = state.phase === "inside" ? 0.54 : state.phase === "outside" ? 0.38 : 1;
      const intensity = clamp01(profile.intensity + state.signalLevel / 210);
      const gridAlpha = (0.018 + intensity * 0.028 + state.reactions.phase * 0.02) * reduction;
      const gap = width < 980 ? 42 : 52;
      const drift = 0;

      context.save();
      context.lineWidth = 1;
      context.strokeStyle = palette.low;
      context.globalAlpha = gridAlpha;

      for (let x = -gap + drift; x < width + gap; x += gap) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }

      context.globalAlpha = gridAlpha * 0.62;
      for (let y = gap * 0.5; y < height; y += gap) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      context.restore();
    };

    const drawFilaments = () => {
      const state = runtimeRef.current;
      const profile = phaseProfile(state.phase);
      const palette = paletteForPhase(state.phase);
      const geometry = apparatusGeometry(width, height, state.phase, state.signalLevel);
      const origin = currentTerminalOrigin();
      const input = signalInput(state.terminalSignal);
      const typing = state.reactions.typing;
      const submit = state.reactions.submit;
      const trace = Math.max(eventAmount("trace"), state.phase === "assembly" || state.phase === "boundary" ? 0.34 : 0);
      const signal = Math.max(eventAmount("make-signal"), eventAmount("boundary"), submit * 0.28);
      const phaseReduction = state.phase === "inside" ? 0.58 : state.phase === "outside" ? state.reactions.release * 0.22 : 1;

      nodes.forEach((node) => {
        const movement = reducedMotion ? 0 : 1;
        const swayX = Math.sin(frame * 0.005 + node.phase) * 4.2 * node.weight * movement;
        const swayY = Math.cos(frame * 0.004 + node.phase) * 3.4 * node.weight * movement;
        const pointerPull = state.pointer.active
          ? Math.max(0, 1 - Math.hypot(node.homeX - state.pointer.x, node.homeY - state.pointer.y) / 240)
          : 0;

        node.x = node.homeX + swayX + (node.homeX - state.pointer.x) * pointerPull * 0.02;
        node.y = node.homeY + swayY + (node.homeY - state.pointer.y) * pointerPull * 0.02;
      });

      context.save();
      context.lineWidth = 1;
      context.lineCap = "round";

      const leadNodes = nodes
        .map((node, index) => ({ node, index, distance: Math.hypot(node.homeX - origin.x, node.homeY - origin.y) }))
        .sort((first, second) => first.distance - second.distance)
        .slice(0, 4);

      leadNodes.forEach(({ node }, index) => {
        const amount = index / Math.max(1, leadNodes.length - 1);
        const curve = Math.sin(amount * Math.PI) * 26;
        context.globalAlpha = (0.045 + profile.filamentAlpha * 0.14 + typing * 0.18 + submit * 0.16) * phaseReduction;
        context.strokeStyle = index % 2 === 0 ? palette.secondary : palette.low;
        context.setLineDash([8 + index * 3, 22 - index * 2]);
        context.lineDashOffset = reducedMotion ? 0 : -frame * (0.18 + index * 0.05);
        context.beginPath();
        context.moveTo(origin.x, origin.y);
        context.quadraticCurveTo(lerp(origin.x, node.x, 0.48), lerp(origin.y, node.y, 0.48) - curve, node.x, node.y);
        context.stroke();
      });

      filaments.forEach((filament, index) => {
        const from = nodes[filament.from];
        const to = nodes[filament.to];
        if (!from || !to) {
          return;
        }

        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const visibleDistance = Math.min(width, height) * (0.18 + profile.intensity * 0.56 + trace * 0.38);
        if (distance > visibleDistance && state.phase === "dormant") {
          return;
        }

        const alpha = (filament.alpha + profile.filamentAlpha * 0.28 + trace * 0.28 + signal * 0.18 + submit * 0.08) * phaseReduction;
        context.globalAlpha = Math.min(0.52, alpha);
        context.strokeStyle = index % 3 === 0 ? palette.secondary : palette.low;
        context.setLineDash([filament.dash, filament.dash * 2]);
        context.lineDashOffset = reducedMotion ? 0 : -frame * (0.08 + filament.speed * 18);
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();

        if (!reducedMotion && (trace > 0.08 || submit > 0.08 || index % 4 === 0)) {
          const progress = (frame * filament.speed * (trace > 0.08 ? 2.8 : 1.4) + filament.offset + submit * 0.18) % 1;
          const pulseX = lerp(from.x, to.x, progress);
          const pulseY = lerp(from.y, to.y, progress);
          context.globalAlpha = Math.min(0.82, (0.16 + trace * 0.38 + submit * 0.32) * phaseReduction);
          context.fillStyle = index % 2 === 0 ? palette.secondary : palette.primary;
          context.fillRect(pulseX - 1.4, pulseY - 1.4, 2.8, 2.8);
        }
      });

      context.setLineDash([]);
      nodes.forEach((node, index) => {
        const nearAperture = Math.hypot(node.x - geometry.centerX, node.y - geometry.centerY) < geometry.base * 1.2;
        if (state.phase === "dormant" && !nearAperture && index % 4 !== 0) {
          return;
        }

        context.globalAlpha = (0.08 + profile.filamentAlpha * 0.24 + trace * 0.2 + typing * 0.08) * phaseReduction;
        context.fillStyle = nearAperture ? palette.primary : palette.secondary;
        context.fillRect(node.x - 1, node.y - 1, 2, 2);
      });

      if (input) {
        drawSignalPackets(origin, geometry.centerX - geometry.base * 0.74, geometry.centerY, input);
      }

      context.restore();
    };

    const drawSignalPackets = (origin: { x: number; y: number }, targetX: number, targetY: number, input: string) => {
      const state = runtimeRef.current;
      const palette = paletteForPhase(state.phase);
      const fingerprint = inputFingerprint(input);
      const typing = state.reactions.typing;
      const submit = state.reactions.submit;
      const strength = clamp01(0.18 + typing * 0.82 + submit * 0.7 + prefixStrength(input) * 0.28);
      const packetCount = reducedMotion ? 4 : Math.min(12, 3 + input.length);

      context.save();
      context.fillStyle = palette.secondary;
      context.strokeStyle = palette.low;
      context.globalAlpha = 0.08 + strength * 0.22;
      context.setLineDash([2, 18]);
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.quadraticCurveTo(lerp(origin.x, targetX, 0.46), lerp(origin.y, targetY, 0.46) - 70, targetX, targetY);
      context.stroke();
      context.setLineDash([]);

      for (let index = 0; index < packetCount; index += 1) {
        const seeded = (fingerprint + index * 0.127) % 1;
        const progress = reducedMotion ? seeded : (frame * (0.01 + submit * 0.018) + seeded + typing * 0.14) % 1;
        const midX = lerp(origin.x, targetX, progress);
        const midY = lerp(origin.y, targetY, progress) - Math.sin(progress * Math.PI) * (62 + seeded * 24);
        const packetSize = 1.5 + strength * 2.8 + (index % 3) * 0.4;
        context.globalAlpha = Math.max(0.04, (1 - Math.abs(progress - 0.58)) * strength * 0.72);
        context.fillRect(midX - packetSize / 2, midY - packetSize / 2, packetSize, packetSize);
      }

      context.restore();
    };

    const drawSignalSlots = () => {
      const state = runtimeRef.current;
      const puzzle = state.puzzle;
      const palette = paletteForPhase(state.phase);
      const geometry = apparatusGeometry(width, height, state.phase, state.signalLevel);
      const input = signalInput(state.terminalSignal);
      const typedToken = signalTokenInput(input);
      const typedMatch = tokenPrefixMatch(typedToken, puzzle.signalToken);
      const matchedSlotNumbers = new Set(puzzle.traceOrder.slice(0, Math.ceil(typedMatch * puzzle.signalToken.length)));
      const tracePositionBySlot = new Map(puzzle.traceOrder.map((slotNumber, index) => [slotNumber, index]));
      const listenEvent = eventAmount("listen");
      const traceEvent = eventAmount("trace");
      const alignEvent = eventAmount("align-correct");
      const compileEvent = eventAmount("make-signal");
      const boundaryEvent = eventAmount("boundary");
      const listen = Math.max(listenEvent, puzzle.hasListened ? 0.5 : 0);
      const trace = Math.max(traceEvent, puzzle.hasTraced ? 0.5 : 0);
      const decoded = Math.max(alignEvent, puzzle.hasDecodedSignal ? 0.72 : 0);
      const wrong = Math.max(eventAmount("align-wrong", "error"), state.reactions.error);
      const hint = Math.max(eventAmount("hint", "inspect"), puzzle.usedReadHint ? 0.16 : 0);
      const releaseProgress = state.phase === "outside" ? clamp01(1 - state.reactions.release) : 0;

      if (state.phase === "outside" && releaseProgress > 0.98) {
        return;
      }

      const listenProgress = !puzzle.hasListened || reducedMotion ? 1 : listenEvent > 0.01 ? clamp01(1 - listenEvent) : 1;
      const traceProgress = !puzzle.hasTraced || reducedMotion ? 1 : traceEvent > 0.01 ? clamp01(1 - traceEvent * 0.9) : 1;
      const alignProgress = !puzzle.hasDecodedSignal
        ? 0
        : reducedMotion || alignEvent <= 0.01
          ? 1
          : clamp01(1 - alignEvent * 0.94);
      const openProgress = !puzzle.boundaryOpen
        ? 0
        : reducedMotion || boundaryEvent <= 0.01
          ? 1
          : clamp01(1 - boundaryEvent * 0.94);
      const slotSize = Math.max(10, geometry.cellSize * 3.8);
      const slotRadiusX = geometry.base * 1.08;
      const slotRadiusY = geometry.base * 1.12;
      const slots = puzzle.signalSlots.map((slot, index) => {
        const position = SIGNAL_SLOT_POSITIONS[index] ?? { x: 0, y: 0 };
        const slotNumber = index + 1;
        const tracePosition = tracePositionBySlot.get(slotNumber) ?? -1;
        const locked = puzzle.hasDecodedSignal || matchedSlotNumbers.has(slotNumber);
        const carrierX = geometry.centerX + position.x * slotRadiusX;
        const carrierY = geometry.centerY + position.y * slotRadiusY;
        const targetX = geometry.centerX + (tracePosition - 2) * geometry.base * 0.29;
        const targetY = geometry.centerY;
        const previewAlignment = matchedSlotNumbers.has(slotNumber) ? 0.68 + typedMatch * 0.18 : 0;
        const alignment = puzzle.hasDecodedSignal ? alignProgress : previewAlignment;
        const splitDirection = tracePosition < 2 ? -1 : tracePosition > 2 ? 1 : 0;
        const boundarySplit = openProgress * splitDirection * geometry.base * 0.22;
        const shear = wrong > 0.04 ? Math.sin(frame * 0.22 + index * 1.7) * wrong * 12 : 0;
        const x = lerp(carrierX, targetX, alignment) + boundarySplit + shear;
        const y =
          lerp(carrierY, targetY, alignment) +
          Math.sin(frame * 0.016 + index) * (reducedMotion ? 0 : listen * (1 - alignment) * 1.8);

        return { x, y, slot, slotNumber, tracePosition, locked };
      });

      context.save();
      context.lineWidth = 1;
      context.textAlign = "center";
      context.textBaseline = "middle";

      if (trace > 0.04) {
        const slotsByNumber = new Map(slots.map((slot) => [slot.slotNumber, slot]));
        context.strokeStyle = wrong > 0.04 ? palette.warning : decoded > 0.2 ? palette.secondary : palette.low;
        context.setLineDash([4, 12]);
        context.lineDashOffset = reducedMotion ? 0 : -frame * (0.18 + decoded * 0.18);
        context.globalAlpha = Math.min(0.58, (0.08 + trace * 0.34 + decoded * 0.18) * (1 - releaseProgress));
        for (let index = 0; index < puzzle.traceOrder.length - 1; index += 1) {
          const from = slotsByNumber.get(puzzle.traceOrder[index]);
          const to = slotsByNumber.get(puzzle.traceOrder[index + 1]);
          if (!from || !to || traceProgress * (puzzle.traceOrder.length - 1) < index + 0.18) {
            continue;
          }
          context.beginPath();
          context.moveTo(from.x, from.y);
          const segmentProgress = clamp01(traceProgress * (puzzle.traceOrder.length - 1) - index);
          context.lineTo(lerp(from.x, to.x, segmentProgress), lerp(from.y, to.y, segmentProgress));
          context.stroke();
        }
        context.setLineDash([]);
      }

      slots.forEach((slot, index) => {
        const listened = puzzle.hasListened || listen > 0.12;
        const traced = puzzle.hasTraced || trace > 0.12;
        const activeTrace = traced && slot.tracePosition >= 0;
        const revealed = listened && listenProgress * puzzle.signalSlots.length >= index + 0.2;
        const labelAlpha = revealed ? 0.56 + listen * 0.2 + decoded * 0.14 : 0;
        const slotAlpha = Math.max(
          0.05,
          (0.12 + listen * 0.2 + trace * 0.12 + decoded * 0.24 + (slot.locked ? 0.18 : 0) + hint * 0.08) *
            (1 - releaseProgress)
        );
        const pulse = reducedMotion ? 0 : Math.sin(frame * 0.045 + index * 0.9) * 0.045;
        const size = slotSize + decoded * 2 + (slot.locked ? 2 : 0) + compileEvent * 2 + wrong * (index % 2 === 0 ? 2 : 0);

        context.globalAlpha = Math.min(0.78, slotAlpha + pulse);
        context.strokeStyle = wrong > 0.05 && !slot.locked ? palette.warning : slot.locked || activeTrace ? palette.secondary : palette.low;
        context.fillStyle = palette.fill;
        context.strokeRect(slot.x - size / 2, slot.y - size / 2, size, size);

        context.globalAlpha = Math.min(0.54, slotAlpha * 0.72 + (slot.locked ? 0.18 : 0));
        context.fillStyle = slot.locked ? palette.secondary : palette.primary;
        const inner = size * (slot.locked ? 0.32 : 0.18);
        context.fillRect(slot.x - inner / 2, slot.y - inner / 2, inner, inner);

        if (revealed) {
          context.globalAlpha = Math.min(0.7, labelAlpha);
          context.fillStyle = slot.locked ? palette.secondary : palette.primary;
          context.font = `${width < 980 ? 9 : 10}px SFMono-Regular, ui-monospace, monospace`;
          context.fillText(puzzle.hasDecodedSignal ? slot.slot : `${slot.slotNumber}:${slot.slot}`, slot.x, slot.y - size * 0.9);
        }

        if (activeTrace && !puzzle.hasDecodedSignal) {
          context.globalAlpha = Math.min(0.52, 0.18 + trace * 0.3 + decoded * 0.2);
          context.fillStyle = palette.secondary;
          context.font = `${width < 980 ? 8 : 9}px SFMono-Regular, ui-monospace, monospace`;
          context.fillText(String(slot.tracePosition + 1), slot.x, slot.y + size * 0.9);
        }
      });

      if (decoded > 0.2 && puzzle.hasDecodedSignal) {
        const orderedSlots = [...slots].sort((first, second) => first.tracePosition - second.tracePosition);
        context.strokeStyle = palette.secondary;
        context.globalAlpha = Math.min(0.54, (0.16 + decoded * 0.26 + compileEvent * 0.18) * (1 - releaseProgress));
        context.setLineDash(puzzle.hasMadeSignal ? [] : [2, 7]);
        context.beginPath();
        orderedSlots.forEach((slot, index) => {
          if (index === 0) {
            context.moveTo(slot.x, slot.y);
          } else {
            context.lineTo(slot.x, slot.y);
          }
        });
        context.stroke();
        context.setLineDash([]);
      }

      context.restore();
    };

    const drawCarrierNoise = () => {
      const state = runtimeRef.current;
      const profile = phaseProfile(state.phase);
      const palette = paletteForPhase(state.phase);
      const geometry = apparatusGeometry(width, height, state.phase, state.signalLevel);
      const coherence = clamp01(state.signalLevel / 100);
      const listen = Math.max(eventAmount("listen"), state.phase === "observation" ? 0.16 : 0);
      const typing = state.reactions.typing;
      const release = Math.max(state.reactions.release, state.phase === "outside" ? 0.4 : 0);
      const phaseReduction = state.phase === "inside" ? 0.52 : state.phase === "outside" ? state.reactions.release * 0.14 : state.phase === "dormant" ? 0.7 : 1;
      const origin = currentTerminalOrigin();

      context.save();
      context.textBaseline = "middle";
      context.textAlign = "center";

      particles.forEach((particle, index) => {
        const bandAmount = listen > 0.02 ? 0.72 : 0.18;
        const orbit = particle.phase + frame * (reducedMotion ? 0 : 0.0014 + (index % 5) * 0.00016);
        const orbitX = geometry.centerX + Math.cos(orbit) * geometry.base * (0.58 + (index % 4) * 0.08);
        const orbitY = geometry.centerY + Math.sin(orbit) * geometry.base * (0.92 + (index % 3) * 0.08);
        const bandX = lerp(origin.x, geometry.centerX, (index % 17) / 16);
        const wave = Math.sin((index * 0.62 + frame * (reducedMotion ? 0 : 0.035)) + coherence * 4) * (10 + listen * 24);
        const bandY = lerp(origin.y, geometry.centerY, 0.46) + wave;
        const targetX = lerp(lerp(particle.homeX, orbitX, coherence * 0.54), bandX, bandAmount * listen);
        const targetY = lerp(lerp(particle.homeY, orbitY, coherence * 0.44), bandY, bandAmount * listen);
        const pointerPush = state.pointer.active ? Math.max(0, 1 - Math.hypot(particle.x - state.pointer.x, particle.y - state.pointer.y) / 170) : 0;

        if (!reducedMotion) {
          particle.vx = particle.vx * 0.92 + (targetX - particle.x) * (0.0015 + listen * 0.0022) + (particle.x - state.pointer.x) * pointerPush * 0.004;
          particle.vy = particle.vy * 0.92 + (targetY - particle.y) * (0.0015 + listen * 0.0022) + (particle.y - state.pointer.y) * pointerPush * 0.004;
          particle.x += particle.vx + Math.sin(frame * 0.011 + particle.phase) * 0.04;
          particle.y += particle.vy + Math.cos(frame * 0.009 + particle.phase) * 0.035;
        } else {
          particle.x = lerp(particle.x, targetX, 0.05);
          particle.y = lerp(particle.y, targetY, 0.05);
        }

        if (particle.x < -28) particle.x = width + 28;
        if (particle.x > width + 28) particle.x = -28;
        if (particle.y < -28) particle.y = height + 28;
        if (particle.y > height + 28) particle.y = -28;

        const flicker = reducedMotion ? 0 : Math.sin(frame * 0.038 + particle.phase) * 0.035;
        const alpha =
          (particle.alpha + profile.noiseAlpha * 0.24 + listen * 0.22 + typing * 0.08 + pointerPush * 0.12 + flicker) * phaseReduction -
          release * 0.07;
        context.globalAlpha = Math.max(0.012, Math.min(0.46, alpha));
        context.fillStyle = index % 8 === 0 ? palette.secondary : palette.primary;
        context.font = `${particle.size}px SFMono-Regular, ui-monospace, monospace`;
        context.fillText(particle.char, particle.x, particle.y);
      });

      if (listen > 0.03) {
        context.strokeStyle = palette.secondary;
        context.lineWidth = 1;
        context.globalAlpha = Math.min(0.34, 0.08 + listen * 0.26);
        context.beginPath();
        for (let index = 0; index < 86; index += 1) {
          const amount = index / 85;
          const x = lerp(origin.x, geometry.centerX + geometry.base * 0.58, amount);
          const y = lerp(origin.y, geometry.centerY, amount) - Math.sin(amount * Math.PI) * 42 + Math.sin(amount * Math.PI * 6 + frame * 0.055) * (5 + listen * 15);
          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.stroke();
      }

      context.restore();
    };

    const drawApparatus = () => {
      const state = runtimeRef.current;
      const profile = phaseProfile(state.phase);
      const palette = paletteForPhase(state.phase);
      const geometry = apparatusGeometry(width, height, state.phase, state.signalLevel);
      const input = signalInput(state.terminalSignal);
      const fingerprint = inputFingerprint(input);
      const prefix = prefixStrength(input);
      const inputLength = clamp01(input.length / 24);
      const typing = state.reactions.typing;
      const submit = state.reactions.submit;
      const error = state.reactions.error;
      const inspect = state.reactions.inspect;
      const wake = eventAmount("wake");
      const makeSignal = eventAmount("make-signal");
      const boundary = Math.max(eventAmount("boundary"), state.phase === "boundary" ? 0.42 : 0);
      const enter = Math.max(eventAmount("enter"), state.phase === "inside" ? 0.24 : 0);
      const release = state.reactions.release;
      const opening = clamp01(profile.split + boundary * 0.32 + enter * 0.18 + release * 0.32);
      const boundaryVisible = state.signalLevel >= 66 || state.phase === "boundary" || state.phase === "inside" || state.phase === "outside";
      const apertureScale = 1 + wake * 0.06 + makeSignal * 0.05 - release * 0.18;
      const phaseReduction = state.phase === "outside" ? clamp01(release * 1.2) : 1;
      const transitionEmphasis = submit + makeSignal + boundary + release;

      if (state.phase === "outside" && phaseReduction <= 0.015) {
        return;
      }

      context.save();
      context.shadowColor = error > 0.04 ? palette.warning : palette.primary;
      context.shadowBlur = transitionEmphasis > 0.04 ? 1 + transitionEmphasis * 6 : 0;

      cells.forEach((cell) => {
        const side = cell.nx < 0 ? -1 : 1;
        const bootDistance = Math.abs(cell.row - (geometry.rows - 1) / 2) / Math.max(1, geometry.rows / 2);
        const bootSweep = wake > 0 ? clamp01(wake * 1.45 - bootDistance * 0.9) : 0;
        const signalContour = boundaryVisible && (cell.boundary || (cell.shell && Math.abs(cell.nx) < 0.2));
        const typedAlignment = typing * (0.08 + prefix * 0.22 + inputLength * 0.1);
        const hashMatch = 1 - Math.abs(((cell.seed + fingerprint + cell.column * 0.013) % 1) - 0.5) * 2;
        const shimmer = reducedMotion ? 0.1 : Math.sin(frame * 0.034 + cell.column * 0.44 + cell.row * 0.6) * 0.06;
        const dormantDrop = state.phase === "dormant" && cell.seed > 0.58 + bootSweep * 0.32 + typing * 0.1;
        const openSlot = opening > 0.2 && Math.abs(cell.nx) < 0.09 + opening * 0.13 && Math.abs(cell.ny) < 0.82;

        if (dormantDrop || openSlot) {
          return;
        }

        const splitOffset = side * opening * geometry.base * (0.42 + Math.abs(cell.ny) * 0.08);
        const shear = error > 0.02 ? Math.sin(cell.row * 0.95 + frame * 0.18) * error * 16 : 0;
        const alignOffset = typedAlignment * hashMatch * (cell.boundary ? 10 : 5) * (cell.nx >= 0 ? 1 : -1);
        const x = geometry.centerX + cell.nx * geometry.base * 0.8 * apertureScale + splitOffset + shear + alignOffset;
        const y =
          geometry.centerY +
          cell.ny * geometry.base * 1.12 * profile.compression * apertureScale +
          Math.sin(frame * 0.018 + cell.seed * 8) * (reducedMotion ? 0 : typing * 1.8);
        const boundaryBoost = signalContour ? 0.26 + makeSignal * 0.3 + boundary * 0.24 : 0;
        const corridorBoost = cell.corridor ? submit * 0.18 + typedAlignment * 0.3 : 0;
        const inspectBoost = inspect > 0.02 && (cell.row + Math.floor(frame / 4)) % 6 === 0 ? inspect * 0.36 : 0;
        const releaseFade = release * (cell.core ? 0.18 : 0.34);
        const alpha = clamp01(
          (profile.cellAlpha * 0.42 +
            bootSweep * 0.36 +
            boundaryBoost +
            corridorBoost +
            typedAlignment * hashMatch +
            inspectBoost +
            shimmer +
            error * 0.16 -
            releaseFade) *
            phaseReduction
        );

        if (alpha < 0.026) {
          return;
        }

        const size = geometry.cellSize + bootSweep * 1.2 + makeSignal * 1 + inspectBoost * 2 + error * 0.9;
        context.globalAlpha = alpha;
        context.fillStyle = error > 0.06 && hashMatch > 0.52 ? palette.warning : cell.boundary || cell.core || cell.corridor ? palette.secondary : palette.primary;
        context.fillRect(x - size / 2, y - size / 2, size, size);
      });

      drawSignalSlots();

      const frameWidth = geometry.base * 0.72 * apertureScale;
      const frameHeight = geometry.base * 1.02 * profile.compression * apertureScale;
      const chamfer = geometry.base * 0.18;
      const frameSplit = opening * geometry.base * 0.38;
      const seamGap = geometry.base * 0.035 + frameSplit;
      const frameAlpha = boundaryVisible
        ? 0.16 + makeSignal * 0.32 + boundary * 0.22
        : 0.05 + wake * 0.1 + typing * 0.05;

      context.lineWidth = 1;
      context.strokeStyle = boundaryVisible ? palette.secondary : palette.low;
      context.globalAlpha = frameAlpha * phaseReduction;
      context.setLineDash(state.puzzle.hasMadeSignal ? [] : [3, 10]);

      const drawFrameHalf = (side: -1 | 1) => {
        const outerX = geometry.centerX + side * (frameWidth + frameSplit);
        const innerX = geometry.centerX + side * seamGap;
        context.beginPath();
        context.moveTo(innerX, geometry.centerY - frameHeight);
        context.lineTo(outerX - side * chamfer, geometry.centerY - frameHeight);
        context.lineTo(outerX, geometry.centerY - frameHeight + chamfer);
        context.lineTo(outerX, geometry.centerY + frameHeight - chamfer);
        context.lineTo(outerX - side * chamfer, geometry.centerY + frameHeight);
        context.lineTo(innerX, geometry.centerY + frameHeight);
        context.stroke();
      };

      drawFrameHalf(-1);
      drawFrameHalf(1);
      context.setLineDash([]);

      for (let index = -3; index <= 3; index += 1) {
        if (index === 0) {
          continue;
        }
        const tickY = geometry.centerY + index * geometry.base * 0.23;
        const tickLength = index % 2 === 0 ? geometry.base * 0.09 : geometry.base * 0.055;
        context.globalAlpha = (0.045 + profile.intensity * 0.07 + makeSignal * 0.11) * phaseReduction;
        context.strokeStyle = palette.low;
        context.beginPath();
        context.moveTo(geometry.centerX - frameWidth - tickLength - frameSplit, tickY);
        context.lineTo(geometry.centerX - frameWidth - frameSplit, tickY);
        context.moveTo(geometry.centerX + frameWidth + frameSplit, tickY);
        context.lineTo(geometry.centerX + frameWidth + tickLength + frameSplit, tickY);
        context.stroke();
      }

      if (opening > 0.16) {
        context.globalAlpha = (0.1 + opening * 0.32) * phaseReduction;
        context.strokeStyle = state.phase === "outside" ? palette.primary : palette.secondary;
        context.beginPath();
        context.moveTo(geometry.centerX, geometry.centerY - frameHeight * (0.82 + opening * 0.12));
        context.lineTo(geometry.centerX, geometry.centerY + frameHeight * (0.82 + opening * 0.12));
        context.stroke();
      }

      if (inspect > 0.02 || eventAmount("scan") > 0.02) {
        drawInspectionShutters(geometry.centerX, geometry.centerY, geometry.base, Math.max(inspect, eventAmount("scan")));
      }

      if (error > 0.02) {
        context.globalAlpha = Math.min(0.34, error * 0.3);
        context.strokeStyle = palette.warning;
        context.beginPath();
        context.moveTo(geometry.centerX - geometry.base * 0.86, geometry.centerY - geometry.base * 0.32 + error * 10);
        context.lineTo(geometry.centerX + geometry.base * 0.8, geometry.centerY + geometry.base * 0.2 - error * 8);
        context.stroke();
      }

      context.restore();
    };

    const drawInspectionShutters = (centerX: number, centerY: number, base: number, amount: number) => {
      const palette = paletteForPhase(runtimeRef.current.phase);
      const shutterCount = reducedMotion ? 3 : 6;
      context.save();
      context.strokeStyle = palette.secondary;
      context.lineWidth = 1;
      for (let index = 0; index < shutterCount; index += 1) {
        const offset = (index - (shutterCount - 1) / 2) * base * 0.13;
        const travel = reducedMotion ? 0 : Math.sin(frame * 0.07 + index) * amount * 10;
        context.globalAlpha = Math.min(0.36, 0.08 + amount * 0.22 - index * 0.006);
        context.beginPath();
        context.moveTo(centerX - base * 0.78, centerY + offset + travel);
        context.lineTo(centerX + base * 0.78, centerY + offset - travel);
        context.stroke();
      }
      context.restore();
    };

    const drawPhaseSweep = () => {
      const state = runtimeRef.current;
      const palette = paletteForPhase(state.phase);
      const profile = phaseProfile(state.phase);
      const geometry = apparatusGeometry(width, height, state.phase, state.signalLevel);
      const phase = state.reactions.phase;
      const submit = state.reactions.submit;
      const release = state.reactions.release;
      const amount = Math.max(phase, submit * 0.42, release);

      if (amount <= 0.015) {
        return;
      }

      const wake = eventAmount("wake");
      const y = wake > 0 ? lerp(geometry.centerY - geometry.base, geometry.centerY + geometry.base, 1 - wake) : geometry.centerY + Math.sin(frame * 0.012) * geometry.base * 0.28;
      const x = lerp(currentTerminalOrigin().x, geometry.centerX, clamp01(state.signalLevel / 100));

      context.save();
      context.lineWidth = 1;
      context.strokeStyle = state.reactions.error > 0.02 ? palette.warning : state.phase === "outside" ? palette.primary : palette.secondary;
      context.globalAlpha = Math.min(0.42, 0.05 + profile.intensity * 0.08 + amount * 0.2);
      context.beginPath();
      context.moveTo(width * 0.06, y);
      context.lineTo(width * 0.94, y);
      context.stroke();

      context.globalAlpha = Math.min(0.32, 0.04 + amount * 0.16);
      context.beginPath();
      context.moveTo(x, height * 0.12);
      context.lineTo(x, height * 0.88);
      context.stroke();
      context.restore();
    };

    const drawOutsideResidue = () => {
      const state = runtimeRef.current;
      if (state.phase !== "outside" && state.reactions.release <= 0.02) {
        return;
      }

      const palette = paletteForPhase(state.phase);
      const settled = state.phase === "outside" ? clamp01(1 - state.reactions.release) : clamp01(state.reactions.release * 0.24);
      const geometry = apparatusGeometry(width, height, "outside", 100);
      const extent = geometry.base * (0.14 + settled * 0.92);

      context.save();
      context.strokeStyle = palette.primary;
      context.fillStyle = palette.primary;
      context.globalAlpha = Math.min(0.42, 0.04 + settled * 0.2);
      context.beginPath();
      context.moveTo(geometry.centerX - extent, geometry.centerY);
      context.lineTo(geometry.centerX + extent, geometry.centerY);
      context.stroke();

      const residue = [-0.78, -0.36, 0, 0.38, 0.78];
      residue.forEach((position, index) => {
        const settle = reducedMotion ? 0 : Math.sin(frame * 0.007 + index * 1.4) * 1.4;
        const x = geometry.centerX + position * geometry.base;
        const y = geometry.centerY + (index % 2 === 0 ? -1 : 1) * geometry.base * 0.055 + settle;
        context.globalAlpha = Math.min(0.42, Math.max(0, settled * 0.3 - index * 0.008));
        context.fillRect(x - 1.5, y - 1.5, 3, 3);
      });

      context.globalAlpha = Math.min(0.3, 0.04 + settled * 0.14);
      context.beginPath();
      context.moveTo(geometry.centerX, geometry.centerY - geometry.base * 0.42);
      context.lineTo(geometry.centerX, geometry.centerY + geometry.base * 0.42);
      context.stroke();

      context.restore();
    };

    const draw = (timestamp: number) => {
      if (!pageVisible || !surfaceEnabled) {
        return;
      }

      animationFrame = window.requestAnimationFrame(draw);
      const frameInterval = reducedMotion ? 160 : width < 1100 ? 1000 / 45 : 1000 / 60;
      if (timestamp - lastDrawTime < frameInterval) {
        return;
      }
      lastDrawTime = timestamp;
      frame = timestamp / (1000 / 60);
      consumeTerminalSignal();

      const state = runtimeRef.current;
      const palette = paletteForPhase(state.phase);
      context.fillStyle = reducedMotion ? "#020705" : palette.fill;
      context.fillRect(0, 0, width, height);

      drawBaseField();
      drawFilaments();
      drawCarrierNoise();
      drawApparatus();
      drawPhaseSweep();
      drawOutsideResidue();

      state.reactions = decayReactions(state.reactions, reducedMotion);
    };

    const startDrawing = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(draw);
    };

    const handleVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      if (pageVisible && surfaceEnabled) {
        lastDrawTime = 0;
        startDrawing();
      } else {
        window.cancelAnimationFrame(animationFrame);
      }
    };

    const handleSurfaceChange = () => {
      surfaceEnabled = !mobileSurface.matches;
      window.cancelAnimationFrame(animationFrame);

      if (surfaceEnabled && pageVisible) {
        lastDrawTime = 0;
        resize();
        startDrawing();
      }
    };

    const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      canvas.dataset.motion = reducedMotion ? "reduced" : "full";
      runtimeRef.current.reactions = createReactionChannels();
      lastDrawTime = 0;
      if (surfaceEnabled) {
        buildField();
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }
      runtimeRef.current.pointer = { x: event.clientX, y: event.clientY, active: true };
    };

    const handlePointerLeave = () => {
      runtimeRef.current.pointer.active = false;
    };

    if (surfaceEnabled) {
      resize();
      startDrawing();
    }
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(document.documentElement);
    window.addEventListener("resize", scheduleResize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibility);
    mobileSurface.addEventListener("change", handleSurfaceChange);
    motionPreference.addEventListener("change", handleMotionPreferenceChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
      mobileSurface.removeEventListener("change", handleSurfaceChange);
      motionPreference.removeEventListener("change", handleMotionPreferenceChange);
    };
  }, [terminalSignalRef]);

  return <canvas ref={canvasRef} className="quiet-canvas" aria-hidden="true" />;
}
