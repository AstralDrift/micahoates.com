"use client";

import { useId, useRef, type PointerEvent } from "react";

import { TRACE_NODES, type TraceNode, type TraceProgress } from "@/lib/world-state";

type BrandSchematicProps = {
  progress: TraceProgress;
  activeNode: TraceNode | null;
  onEnterInterface: (node?: TraceNode) => void;
};

const NODE_LAYOUT: Record<TraceNode, { cx: number; cy: number; labelX: number; labelY: number }> = {
  carrier: { cx: 156, cy: 210, labelX: 168, labelY: 204 },
  signal: { cx: 248, cy: 300, labelX: 258, labelY: 296 },
  boundary: { cx: 320, cy: 160, labelX: 272, labelY: 148 },
  release: { cx: 360, cy: 118, labelX: 330, labelY: 104 }
};

export function BrandSchematic({ progress, activeNode, onEnterInterface }: BrandSchematicProps) {
  const gradientId = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const node = rootRef.current;
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty("--schematic-x", x.toFixed(3));
    node.style.setProperty("--schematic-y", y.toFixed(3));
  };

  const handlePointerLeave = () => {
    const node = rootRef.current;
    if (!node) {
      return;
    }

    node.style.setProperty("--schematic-x", "0");
    node.style.setProperty("--schematic-y", "0");
  };

  return (
    <div
      ref={rootRef}
      className="brand-schematic-hit"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <svg
        className="brand-schematic"
        viewBox="0 0 420 480"
        role="img"
        aria-label="Signal trace schematic"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.12" />
            <stop offset="48%" stopColor="var(--accent-primary)" stopOpacity="0.92" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        <g className="brand-schematic-frame" stroke="currentColor" strokeWidth="1" fill="none">
          <path d="M24 24h36M24 24v36" />
          <path d="M396 24h-36M396 24v36" />
          <path d="M24 456h36M24 456v-36" />
          <path d="M396 456h-36M396 456v-36" />
        </g>

        <g className="brand-schematic-grid" stroke="currentColor" strokeWidth="1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line key={i} x1="56" y1={72 + i * 44} x2="64" y2={72 + i * 44} />
          ))}
          <line x1="60" y1="64" x2="60" y2="400" />
          <line x1="60" y1="400" x2="360" y2="400" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={`x-${i}`} x1={100 + i * 44} y1="400" x2={100 + i * 44} y2="408" />
          ))}
        </g>

        <path
          className="brand-schematic-signal"
          d="M72 340 C110 340, 118 210, 156 210 S210 360, 248 300 S300 120, 348 148"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.5"
          strokeLinecap="square"
        />

        <g className="brand-schematic-nodes">
          {TRACE_NODES.map((node) => {
            const layout = NODE_LAYOUT[node];
            const lit = progress[node];
            const active = activeNode === node;
            return (
              <circle
                key={node}
                className={`brand-schematic-node${lit ? " is-lit" : ""}${active ? " is-active" : ""}`}
                cx={layout.cx}
                cy={layout.cy}
                r={active ? 5 : 3.5}
              />
            );
          })}
        </g>

        <g className="brand-schematic-labels">
          {TRACE_NODES.map((node) => {
            const layout = NODE_LAYOUT[node];
            const lit = progress[node];
            return (
              <text key={node} x={layout.labelX} y={layout.labelY} className={lit ? "is-lit" : undefined}>
                {node}
              </text>
            );
          })}
          <text x="72" y="428">
            TRACE // open channel
          </text>
        </g>

        <line className="brand-schematic-scan" x1="80" y1="88" x2="80" y2="392" />
      </svg>

      <div className="brand-schematic-node-actions">
        {TRACE_NODES.map((node) => (
          <button
            key={node}
            type="button"
            className={`brand-schematic-node-btn${progress[node] ? " is-lit" : ""}${activeNode === node ? " is-active" : ""}`}
            onClick={() => onEnterInterface(node)}
            aria-label={`Enter interface at ${node} chapter`}
          >
            {node}
          </button>
        ))}
      </div>
    </div>
  );
}
