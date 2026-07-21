import type { QuietInterfaceState } from "@/lib/quiet-interface/state";

export const HINT_DELAY_MS = 2600;

export function contextualHint(state: QuietInterfaceState) {
  if (!state.hasWoken) {
    return state.commandHistory.includes("help") ? "interface.service is inactive" : "try: help";
  }

  if (state.phase === "observation") {
    if (!state.hasScanned && !state.hasListened) {
      return "inspect: ls -la";
    }
    if (!state.hasListened) {
      return "carrier -> carrier.sample";
    }
    if (!state.hasTraced) {
      return "trace -> trace.path";
    }
    if (!state.hasDecodedSignal) {
      return state.alignAttempts >= 2 ? "journal: new entry" : "signal accepts redirected input";
    }
    return "make target: signal";
  }

  if (state.phase === "assembly") {
    if (!state.hasDecodedSignal) {
      return state.alignAttempts >= 2 ? "journal: new entry" : "signal accepts redirected input";
    }
    return "make target: signal";
  }

  if (state.phase === "boundary") {
    if (!state.boundaryOpen) {
      return "boundary is a directory";
    }
    if (!state.hasEntered) {
      return "inside/ is readable";
    }
    return "release is executable";
  }

  if (state.phase === "inside") {
    return "release is executable";
  }

  return undefined;
}
