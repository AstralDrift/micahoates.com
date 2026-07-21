import type { QuietInterfaceState } from "@/lib/quiet-interface/state";

export const TRACE_NODES = ["carrier", "signal", "boundary", "release"] as const;

export type TraceNode = (typeof TRACE_NODES)[number];

export type TraceProgress = Record<TraceNode, boolean>;

export const EMPTY_TRACE_PROGRESS: TraceProgress = {
  carrier: false,
  signal: false,
  boundary: false,
  release: false
};

export function isTraceNode(value: string): value is TraceNode {
  return (TRACE_NODES as readonly string[]).includes(value);
}

/** Which schematic nodes should light based on earned puzzle progress. */
export function progressFromState(
  state: Pick<
    QuietInterfaceState,
    "hasWoken" | "hasDecodedSignal" | "hasMadeSignal" | "boundaryVisible" | "hasReleased" | "phase"
  >
): TraceProgress {
  return {
    carrier: state.hasWoken || state.phase !== "dormant",
    signal: state.hasDecodedSignal || state.hasMadeSignal,
    boundary:
      state.boundaryVisible ||
      state.phase === "boundary" ||
      state.phase === "inside" ||
      state.phase === "outside",
    release: state.hasReleased || state.phase === "outside"
  };
}

export type InterfaceHash = {
  open: boolean;
  node: TraceNode | null;
};

export function parseInterfaceHash(hash: string): InterfaceHash {
  const raw = hash.replace(/^#/, "").trim().toLowerCase();
  if (!raw) {
    return { open: false, node: null };
  }

  if (raw === "interface") {
    return { open: true, node: null };
  }

  const match = raw.match(/^interface\/([a-z]+)$/);
  if (match?.[1] && isTraceNode(match[1])) {
    return { open: true, node: match[1] };
  }

  return { open: false, node: null };
}

export function buildInterfaceHash(node?: TraceNode | null): string {
  if (node) {
    return `#interface/${node}`;
  }

  return "#interface";
}
