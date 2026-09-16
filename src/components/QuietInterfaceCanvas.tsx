"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import {
  VISUAL_EVENT_DURATIONS_MS,
  createStaticField,
  eventEnvelope,
  inputFingerprint,
  matchingTokenCharacters,
  phaseEnergy,
  prefixStrength,
  sceneLayout,
  signalTokenInput,
  type EventEnvelope,
  type SceneLayout,
  type StaticField
} from "@/lib/quiet-interface/canvas-model";
import { PUZZLE_SPEC } from "@/lib/quiet-interface/puzzle-spec";
import {
  hasReadCarrier,
  hasReadTrace,
  type QuietInterfaceState,
  type TerminalSignal,
  type VisualEvent
} from "@/lib/quiet-interface/state";

type QuietInterfaceCanvasProps = {
  state: QuietInterfaceState;
  terminalSignalRef: RefObject<TerminalSignal>;
  visualEvent?: VisualEvent;
  visualEventNonce: number;
  settleNonce: number;
  terminalAnchor: { x: number; y: number };
};

type RuntimeState = {
  state: QuietInterfaceState;
  terminalSignal: TerminalSignal;
  terminalAnchor: { x: number; y: number };
  visualEvent?: VisualEvent;
  visualEventNonce: number;
  settleNonce: number;
  eventStartedAt: number;
  eventSettled: boolean;
  inputStartedAt: number;
  lastSignalNonce: number;
};

const COLORS = {
  ground: "#020705",
  green: "118, 239, 182",
  cyan: "142, 185, 196",
  white: "230, 238, 233",
  amber: "209, 173, 108",
  red: "207, 133, 133"
} as const;

const SLOT_POSITIONS = [
  { x: -0.88, y: -0.58 },
  { x: -0.22, y: -0.96 },
  { x: 0.88, y: -0.4 },
  { x: 0.74, y: 0.72 },
  { x: -0.58, y: 0.9 }
] as const;

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`;
}

function line(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  alpha: number,
  width = 1
): void {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.lineWidth = width;
  context.strokeStyle = rgba(color, alpha);
  context.stroke();
}

function rectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  alpha: number,
  lineWidth = 1
): void {
  context.lineWidth = lineWidth;
  context.strokeStyle = rgba(color, alpha);
  context.strokeRect(x, y, width, height);
}

function squareNode(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  filled: boolean
): void {
  if (filled) {
    context.fillStyle = rgba(color, alpha);
    context.fillRect(x - size / 2, y - size / 2, size, size);
  } else {
    rectangle(context, x - size / 2, y - size / 2, size, size, color, alpha);
  }
}

function drawCachedField(
  context: CanvasRenderingContext2D,
  field: StaticField,
  width: number,
  height: number,
  mobile: boolean
): void {
  context.fillStyle = COLORS.ground;
  context.fillRect(0, 0, width, height);
  const gap = mobile ? 38 : 52;
  context.lineWidth = 1;
  for (let x = gap / 2; x < width; x += gap) line(context, x, 0, x, height, COLORS.cyan, mobile ? 0.018 : 0.024);
  for (let y = gap / 2; y < height; y += gap) line(context, 0, y, width, y, COLORS.green, mobile ? 0.014 : 0.018);

  for (const fieldLine of field.lines) {
    const from = field.points[fieldLine.from];
    const to = field.points[fieldLine.to];
    if (from && to) line(context, from.x, from.y, to.x, to.y, COLORS.cyan, fieldLine.alpha);
  }
  for (const point of field.points) {
    context.fillStyle = rgba(point.x % 3 > 1.5 ? COLORS.green : COLORS.cyan, point.alpha);
    context.fillRect(point.x, point.y, point.size, point.size);
  }

  line(context, width * 0.02, height * 0.5, width * 0.98, height * 0.5, COLORS.cyan, mobile ? 0.016 : 0.028);
}

function drawSeed(context: CanvasRenderingContext2D, layout: SceneLayout, time: number): void {
  const breathe = 1 + Math.sin(time * 0.0011) * 0.025;
  const radius = layout.scale * 0.23 * breathe;
  for (let ring = 0; ring < 4; ring += 1) {
    const size = radius * (0.35 + ring * 0.32);
    rectangle(context, layout.centerX - size, layout.centerY - size, size * 2, size * 2, ring % 2 ? COLORS.cyan : COLORS.green, 0.08 + ring * 0.04);
  }
  line(context, layout.centerX - radius * 1.8, layout.centerY, layout.centerX + radius * 1.8, layout.centerY, COLORS.cyan, 0.22);
  line(context, layout.centerX, layout.centerY - radius * 1.8, layout.centerX, layout.centerY + radius * 1.8, COLORS.green, 0.26);
  squareNode(context, layout.centerX, layout.centerY, layout.mobile ? 5 : 7, COLORS.white, 0.72, true);
}

function receiverNodes(layout: SceneLayout): Array<{ x: number; y: number }> {
  return SLOT_POSITIONS.map((position) => ({
    x: layout.centerX + position.x * layout.scale * 0.72,
    y: layout.centerY + position.y * layout.scale * 0.62
  }));
}

function drawReceiver(
  context: CanvasRenderingContext2D,
  layout: SceneLayout,
  state: QuietInterfaceState,
  time: number,
  envelope: EventEnvelope
): void {
  const nodes = receiverNodes(layout);
  const bootScale = state.lastVisualEvent === "boot" && envelope.active ? 0.18 + envelope.progress * 0.82 : 1;
  context.save();
  context.translate(layout.centerX, layout.centerY);
  context.scale(bootScale, bootScale);
  context.translate(-layout.centerX, -layout.centerY);

  const frameWidth = layout.scale * 1.72;
  const frameHeight = layout.scale * 1.48;
  rectangle(context, layout.centerX - frameWidth / 2, layout.centerY - frameHeight / 2, frameWidth, frameHeight, COLORS.cyan, 0.18 + envelope.pulse * 0.22);
  rectangle(context, layout.centerX - frameWidth * 0.43, layout.centerY - frameHeight * 0.38, frameWidth * 0.86, frameHeight * 0.76, COLORS.green, 0.08);

  nodes.forEach((node, index) => {
    const sampled = hasReadCarrier(state);
    const drift = Math.sin(time * 0.0015 + index * 1.7) * (layout.mobile ? 0.5 : 1.5);
    squareNode(context, node.x, node.y + drift, layout.mobile ? 8 : 11, sampled ? COLORS.green : COLORS.cyan, sampled ? 0.72 : 0.28, sampled);
    line(context, layout.centerX, layout.centerY, node.x, node.y, COLORS.cyan, hasReadTrace(state) ? 0.36 : 0.08);
  });
  squareNode(context, layout.centerX, layout.centerY, layout.mobile ? 5 : 7, COLORS.white, 0.68, true);
  context.restore();
}

function drawTopology(
  context: CanvasRenderingContext2D,
  layout: SceneLayout,
  state: QuietInterfaceState,
  input: string,
  time: number
): void {
  const nodes = receiverNodes(layout);
  const nodeBySlot = new Map<number, { x: number; y: number }>(
    nodes.map((node, index) => [index + 1, node])
  );
  const typedToken = signalTokenInput(input);
  const matched = matchingTokenCharacters(typedToken, PUZZLE_SPEC.token);
  const lockedSlots = new Set<number>(PUZZLE_SPEC.traceOrder.slice(0, matched));

  context.save();
  context.setLineDash([4, layout.mobile ? 8 : 13]);
  context.lineDashOffset = -time * 0.015;
  for (let index = 0; index < PUZZLE_SPEC.traceOrder.length - 1; index += 1) {
    const from = nodeBySlot.get(PUZZLE_SPEC.traceOrder[index] ?? 0);
    const to = nodeBySlot.get(PUZZLE_SPEC.traceOrder[index + 1] ?? 0);
    if (from && to) line(context, from.x, from.y, to.x, to.y, COLORS.cyan, 0.42, lockedSlots.size > index ? 2 : 1);
  }
  context.setLineDash([]);

  nodes.forEach((node, index) => {
    const slot = index + 1;
    const locked = lockedSlots.has(slot);
    const ring = layout.mobile ? 10 : 14;
    squareNode(context, node.x, node.y, ring, locked ? COLORS.white : COLORS.green, locked ? 0.94 : 0.58, locked);
    rectangle(context, node.x - ring, node.y - ring, ring * 2, ring * 2, COLORS.cyan, 0.12);
  });

  const orbit = layout.scale * 0.92;
  context.strokeStyle = rgba(COLORS.green, 0.12);
  context.setLineDash([1, 18]);
  context.beginPath();
  context.arc(layout.centerX, layout.centerY, orbit, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawSignalRail(context: CanvasRenderingContext2D, layout: SceneLayout, time: number, envelope: EventEnvelope): void {
  const width = layout.scale * 2.1;
  const gap = width / 5;
  line(context, layout.centerX - width / 2, layout.centerY, layout.centerX + width / 2, layout.centerY, COLORS.white, 0.56 + envelope.pulse * 0.32, 2);
  line(context, layout.centerX - width / 2, layout.centerY - layout.scale * 0.22, layout.centerX + width / 2, layout.centerY - layout.scale * 0.22, COLORS.cyan, 0.2);
  line(context, layout.centerX - width / 2, layout.centerY + layout.scale * 0.22, layout.centerX + width / 2, layout.centerY + layout.scale * 0.22, COLORS.green, 0.22);
  for (let index = 0; index < 5; index += 1) {
    const x = layout.centerX - width / 2 + gap * (index + 0.5);
    const pulse = 0.68 + Math.sin(time * 0.002 + index) * 0.12;
    rectangle(context, x - gap * 0.32, layout.centerY - layout.scale * 0.16, gap * 0.64, layout.scale * 0.32, index % 2 ? COLORS.cyan : COLORS.green, pulse);
    squareNode(context, x, layout.centerY, layout.mobile ? 4 : 6, COLORS.white, 0.86, true);
  }
  for (let tick = 0; tick <= 20; tick += 1) {
    const x = layout.centerX - width / 2 + (width * tick) / 20;
    const size = tick % 5 === 0 ? layout.scale * 0.12 : layout.scale * 0.05;
    line(context, x, layout.centerY - size / 2, x, layout.centerY + size / 2, COLORS.cyan, tick % 5 === 0 ? 0.34 : 0.12);
  }
}

function checksumBit(index: number): boolean {
  const digit = Number.parseInt(PUZZLE_SPEC.image.checksum[index % PUZZLE_SPEC.image.checksum.length] ?? "0", 16);
  return digit >= 8;
}

function drawImageFrame(
  context: CanvasRenderingContext2D,
  layout: SceneLayout,
  verified: boolean,
  envelope: EventEnvelope
): void {
  const assembly = envelope.active ? Math.max(0.08, envelope.progress) : 1;
  const width = layout.scale * 1.9 * assembly;
  const height = layout.scale * 1.35 * assembly;
  const left = layout.centerX - width / 2;
  const top = layout.centerY - height / 2;
  rectangle(context, left, top, width, height, verified ? COLORS.white : COLORS.green, verified ? 0.72 : 0.48, verified ? 2 : 1);
  rectangle(context, left + width * 0.08, top + height * 0.1, width * 0.84, height * 0.8, COLORS.cyan, verified ? 0.42 : 0.18);
  rectangle(context, left + width * 0.18, top + height * 0.21, width * 0.64, height * 0.58, COLORS.green, verified ? 0.3 : 0.12);

  const bars = layout.mobile ? 24 : 40;
  for (let index = 0; index < bars; index += 1) {
    const x = left + (width * (index + 0.5)) / bars;
    const enabled = checksumBit(index);
    const barHeight = height * (enabled ? 0.16 : 0.07);
    context.fillStyle = rgba(enabled ? COLORS.cyan : COLORS.green, verified ? 0.6 : 0.26);
    context.fillRect(x, layout.centerY - barHeight / 2, Math.max(1, width / bars / 3), barHeight);
  }

  const corner = Math.min(width, height) * 0.13;
  line(context, left - corner * 0.25, top, left + corner, top, COLORS.white, 0.52);
  line(context, left, top - corner * 0.25, left, top + corner, COLORS.white, 0.52);
  line(context, left + width - corner, top + height, left + width + corner * 0.25, top + height, COLORS.white, 0.52);
  line(context, left + width, top + height - corner, left + width, top + height + corner * 0.25, COLORS.white, 0.52);

  if (verified) {
    for (let ray = 0; ray < 12; ray += 1) {
      const angle = (ray / 12) * Math.PI * 2;
      line(
        context,
        layout.centerX + Math.cos(angle) * layout.scale * 0.28,
        layout.centerY + Math.sin(angle) * layout.scale * 0.2,
        layout.centerX + Math.cos(angle) * layout.scale * 0.82,
        layout.centerY + Math.sin(angle) * layout.scale * 0.6,
        ray % 2 ? COLORS.cyan : COLORS.white,
        0.22 + envelope.pulse * 0.24
      );
    }
    squareNode(context, layout.centerX, layout.centerY, layout.mobile ? 8 : 12, COLORS.white, 0.92, false);
  }
}

function drawGate(context: CanvasRenderingContext2D, layout: SceneLayout, height: number, envelope: EventEnvelope): void {
  const progress = envelope.active ? Math.max(0.08, envelope.progress) : 1;
  const gateHeight = Math.min(height * (layout.mobile ? 0.34 : 0.82), layout.scale * (layout.mobile ? 2.1 : 3.05)) * progress;
  const gateWidth = layout.scale * (0.92 + progress * 0.34);
  const left = layout.centerX - gateWidth / 2;
  const top = layout.centerY - gateHeight / 2;

  for (let rail = 0; rail < 4; rail += 1) {
    const inset = rail * (layout.mobile ? 4 : 8);
    rectangle(context, left - inset, top + inset, gateWidth + inset * 2, gateHeight - inset * 2, rail % 2 ? COLORS.green : COLORS.cyan, 0.16 + rail * 0.08);
  }
  const slit = layout.mobile ? 8 : 13;
  context.fillStyle = rgba(COLORS.white, 0.06 + envelope.pulse * 0.14);
  context.fillRect(layout.centerX - slit / 2, top, slit, gateHeight);
  line(context, layout.centerX, top - layout.scale * 0.2, layout.centerX, top + gateHeight + layout.scale * 0.2, COLORS.white, 0.78, 2);

  const rungs = layout.mobile ? 10 : 18;
  for (let index = 0; index <= rungs; index += 1) {
    const y = top + (gateHeight * index) / rungs;
    const extension = index % 3 === 0 ? layout.scale * 0.34 : layout.scale * 0.12;
    line(context, left - extension, y, left + gateWidth + extension, y, index % 2 ? COLORS.cyan : COLORS.green, 0.12 + envelope.pulse * 0.08);
  }
}

function drawTunnel(context: CanvasRenderingContext2D, layout: SceneLayout, time: number, envelope: EventEnvelope): void {
  const layers = layout.mobile ? 7 : 12;
  const rush = envelope.active ? envelope.progress : 1;
  for (let index = layers; index >= 1; index -= 1) {
    const depth = index / layers;
    const shift = ((time * 0.00008 + rush * 0.16) % (1 / layers)) * layout.scale;
    const width = layout.scale * 2.2 * depth + shift;
    const height = layout.scale * 1.5 * depth + shift * 0.62;
    rectangle(context, layout.centerX - width / 2, layout.centerY - height / 2, width, height, index % 2 ? COLORS.cyan : COLORS.green, 0.08 + (1 - depth) * 0.34);
  }
  const outerWidth = layout.scale * 1.12;
  const outerHeight = layout.scale * 0.76;
  const corners = [
    { x: layout.centerX - outerWidth, y: layout.centerY - outerHeight },
    { x: layout.centerX + outerWidth, y: layout.centerY - outerHeight },
    { x: layout.centerX + outerWidth, y: layout.centerY + outerHeight },
    { x: layout.centerX - outerWidth, y: layout.centerY + outerHeight }
  ];
  for (const corner of corners) line(context, corner.x, corner.y, layout.centerX, layout.centerY, COLORS.cyan, 0.24);
  squareNode(context, layout.centerX, layout.centerY, layout.mobile ? 4 : 6, COLORS.white, 0.9, true);
}

function drawHorizon(context: CanvasRenderingContext2D, layout: SceneLayout, width: number, height: number): void {
  const horizonY = layout.mobile ? Math.min(height * 0.28, 220) : height * 0.49;
  line(context, width * 0.03, horizonY, width * 0.97, horizonY, COLORS.cyan, 0.52, 1.5);
  line(context, width * 0.16, horizonY - 5, width * 0.84, horizonY - 5, COLORS.white, 0.12);
  line(context, width * 0.28, horizonY + 8, width * 0.72, horizonY + 8, COLORS.green, 0.15);
  for (let index = 0; index < (layout.mobile ? 8 : 18); index += 1) {
    const fraction = (index + 1) / (layout.mobile ? 9 : 19);
    const x = width * fraction;
    const distance = Math.abs(fraction - 0.5);
    const rise = (1 - distance * 2) * (layout.mobile ? 22 : 64);
    line(context, x, horizonY, layout.centerX + (x - layout.centerX) * 0.26, horizonY - rise, index % 3 ? COLORS.cyan : COLORS.white, 0.05 + (1 - distance) * 0.08);
  }
  squareNode(context, layout.centerX, horizonY, layout.mobile ? 4 : 6, COLORS.white, 0.84, true);
}

function drawInputPackets(
  context: CanvasRenderingContext2D,
  input: string,
  origin: { x: number; y: number },
  target: { x: number; y: number },
  time: number,
  mobile: boolean
): void {
  if (!input) return;
  const strength = prefixStrength(input);
  const coherent = strength > 0.2;
  const fingerprint = inputFingerprint(input);
  const packetCount = mobile ? Math.min(6, 2 + input.length) : Math.min(12, 3 + input.length);
  const controlX = origin.x + (target.x - origin.x) * 0.5;
  const controlY = Math.min(origin.y, target.y) - (mobile ? 20 : 68);

  context.save();
  context.setLineDash(coherent ? [3, 13] : [1, 22]);
  context.lineDashOffset = -time * (coherent ? 0.03 : 0.01);
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.quadraticCurveTo(controlX, controlY, target.x, target.y);
  context.lineWidth = 1;
  context.strokeStyle = rgba(coherent ? COLORS.green : COLORS.red, coherent ? 0.2 + strength * 0.2 : 0.12);
  context.stroke();
  context.setLineDash([]);

  for (let index = 0; index < packetCount; index += 1) {
    const seed = (fingerprint + index * 0.137) % 1;
    const progress = (seed + time * (coherent ? 0.00022 : 0.0001)) % 1;
    const inverse = 1 - progress;
    const x = inverse * inverse * origin.x + 2 * inverse * progress * controlX + progress * progress * target.x;
    const y = inverse * inverse * origin.y + 2 * inverse * progress * controlY + progress * progress * target.y;
    const spread = coherent ? 0 : Math.sin(index * 4.1 + fingerprint * 19) * (mobile ? 12 : 28) * progress;
    squareNode(context, x, y + spread, coherent ? 2.5 + strength * 2 : 2, coherent ? COLORS.cyan : COLORS.red, coherent ? 0.42 + strength * 0.4 : 0.18, true);
  }
  context.restore();
}

function drawReleaseWave(
  context: CanvasRenderingContext2D,
  layout: SceneLayout,
  width: number,
  height: number,
  envelope: EventEnvelope
): void {
  if (!envelope.active) return;
  const radius = Math.max(width, height) * envelope.progress * 1.08;
  context.save();
  context.beginPath();
  context.arc(layout.centerX, layout.centerY, radius, 0, Math.PI * 2);
  context.lineWidth = 1 + envelope.pulse * (layout.mobile ? 16 : 34);
  context.strokeStyle = rgba(COLORS.white, 0.12 + envelope.pulse * 0.62);
  context.stroke();
  context.beginPath();
  context.arc(layout.centerX, layout.centerY, radius * 0.84, 0, Math.PI * 2);
  context.lineWidth = 2 + envelope.pulse * 8;
  context.strokeStyle = rgba(COLORS.cyan, 0.16 + envelope.pulse * 0.52);
  context.stroke();
  context.fillStyle = rgba(COLORS.white, envelope.pulse * 0.035);
  context.fillRect(0, 0, width, height);
  context.restore();
}

function drawScene({
  context,
  state,
  layout,
  width,
  height,
  time,
  input,
  envelope
}: {
  context: CanvasRenderingContext2D;
  state: QuietInterfaceState;
  layout: SceneLayout;
  width: number;
  height: number;
  time: number;
  input: string;
  envelope: EventEnvelope;
}): void {
  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = 0.7 + phaseEnergy(state.progress.kind) * 0.3;
  switch (state.progress.kind) {
    case "dormant":
      drawSeed(context, layout, time);
      break;
    case "observing":
      drawReceiver(context, layout, state, time, envelope);
      break;
    case "decoding":
      drawTopology(context, layout, state, input, time);
      break;
    case "signal-locked":
      drawSignalRail(context, layout, time, envelope);
      break;
    case "image-built":
      drawImageFrame(context, layout, false, envelope);
      break;
    case "image-verified":
      drawImageFrame(context, layout, true, envelope);
      break;
    case "mounted":
      drawGate(context, layout, height, envelope);
      break;
    case "inside":
      drawTunnel(context, layout, time, envelope);
      break;
    case "outside":
      drawHorizon(context, layout, width, height);
      break;
    default: {
      const exhaustive: never = state.progress;
      return exhaustive;
    }
  }
  context.restore();
}

export function QuietInterfaceCanvas({
  state,
  terminalSignalRef,
  visualEvent,
  visualEventNonce,
  settleNonce,
  terminalAnchor
}: QuietInterfaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<RuntimeState>({
    state,
    terminalSignal: { input: "", event: "idle", nonce: 0 },
    terminalAnchor,
    visualEvent,
    visualEventNonce,
    settleNonce,
    eventStartedAt: 0,
    eventSettled: true,
    inputStartedAt: 0,
    lastSignalNonce: 0
  });

  useEffect(() => {
    runtimeRef.current.state = state;
    runtimeRef.current.terminalAnchor = terminalAnchor;
  }, [state, terminalAnchor]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    runtime.visualEvent = visualEvent;
    if (visualEventNonce !== runtime.visualEventNonce) {
      runtime.visualEventNonce = visualEventNonce;
      runtime.eventStartedAt = performance.now();
      runtime.eventSettled = false;
    }
  }, [visualEvent, visualEventNonce]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (settleNonce !== runtime.settleNonce) {
      runtime.settleNonce = settleNonce;
      runtime.eventSettled = true;
    }
  }, [settleNonce]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const cachedCanvas = document.createElement("canvas");
    const cachedContext = cachedCanvas.getContext("2d", { alpha: false });
    if (!cachedContext) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 960px)");
    let reducedMotion = motionQuery.matches;
    let mobile = mobileQuery.matches;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let ratio = 1;
    let animationFrame = 0;
    let resizeFrame = 0;
    let lastDrawAt = 0;
    let visible = document.visibilityState === "visible";
    let field = createStaticField({ width, height, mobile });

    const resize = () => {
      mobile = mobileQuery.matches;
      reducedMotion = motionQuery.matches;
      ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      cachedCanvas.width = canvas.width;
      cachedCanvas.height = canvas.height;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      cachedContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      field = createStaticField({ width, height, mobile });
      drawCachedField(cachedContext, field, width, height, mobile);
      canvas.dataset.motion = reducedMotion ? "reduced" : "full";
      canvas.dataset.renderMode = mobile ? "mobile" : "desktop";
    };

    const scheduleResize = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(resize);
    };

    const consumeSignal = (now: number) => {
      const terminalSignal = terminalSignalRef.current;
      if (terminalSignal.nonce === runtimeRef.current.lastSignalNonce) return;
      runtimeRef.current.lastSignalNonce = terminalSignal.nonce;
      runtimeRef.current.terminalSignal = terminalSignal;
      runtimeRef.current.inputStartedAt = now;
    };

    const frame = (now: number) => {
      if (!visible) return;
      consumeSignal(now);
      const runtime = runtimeRef.current;
      const eventDuration = runtime.visualEvent ? VISUAL_EVENT_DURATIONS_MS[runtime.visualEvent] : 0;
      const envelope = eventEnvelope(now - runtime.eventStartedAt, eventDuration, reducedMotion || runtime.eventSettled);
      const inputAge = now - runtime.inputStartedAt;
      const inputActive = Boolean(runtime.terminalSignal.input) || inputAge < 680;
      const active = envelope.active || inputActive;
      const interval = active && !reducedMotion ? 1_000 / 60 : 1_000 / 24;
      if (now - lastDrawAt >= interval - 1) {
        lastDrawAt = now;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.drawImage(cachedCanvas, 0, 0, cachedCanvas.width, cachedCanvas.height, 0, 0, width, height);
        const layout = sceneLayout(width, height, mobile);
        const submitted = inputAge < 680 ? runtime.terminalSignal.submittedCommand ?? "" : "";
        const input = runtime.terminalSignal.input || submitted;
        drawScene({
          context,
          state: runtime.state,
          layout,
          width,
          height,
          time: reducedMotion ? 0 : now,
          input,
          envelope
        });

        const anchor = runtime.terminalAnchor.x > 0 ? runtime.terminalAnchor : { x: width * 0.12, y: height * 0.78 };
        drawInputPackets(context, input, anchor, { x: layout.centerX, y: layout.centerY }, reducedMotion ? 0 : now, mobile);
        if (runtime.visualEvent === "release") drawReleaseWave(context, layout, width, height, envelope);
      }
      animationFrame = window.requestAnimationFrame(frame);
    };

    const handleVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(frame);
      }
    };

    const handleMotion = () => {
      reducedMotion = motionQuery.matches;
      runtimeRef.current.eventSettled = reducedMotion;
      scheduleResize();
    };

    resize();
    animationFrame = window.requestAnimationFrame(frame);
    window.addEventListener("resize", scheduleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    motionQuery.addEventListener("change", handleMotion);
    mobileQuery.addEventListener("change", scheduleResize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", scheduleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      motionQuery.removeEventListener("change", handleMotion);
      mobileQuery.removeEventListener("change", scheduleResize);
    };
  }, [terminalSignalRef]);

  return (
    <canvas
      ref={canvasRef}
      className="quiet-canvas"
      data-motion="full"
      data-render-mode="desktop"
      data-scene={state.progress.kind}
      aria-hidden="true"
    />
  );
}
