import type { QuietInterfaceState } from "@/lib/quiet-interface/state";

export const HINT_DELAY_MS = 900;

export function contextualHint(state: QuietInterfaceState) {
  if (!state.hasWoken) {
    return "try: wake";
  }

  if (state.phase === "observation") {
    if (!state.hasListened) {
      return "next: listen";
    }
    if (!state.hasTraced) {
      return "next: trace";
    }
    return "next: make signal";
  }

  if (state.phase === "assembly") {
    return "next: make signal";
  }

  if (state.phase === "boundary") {
    if (!state.boundaryOpen) {
      return "next: open boundary";
    }
    if (!state.hasEntered) {
      return "next: enter";
    }
    return "next: release";
  }

  if (state.phase === "inside") {
    return "next: release";
  }

  if (state.phase === "outside") {
    return "try: contact";
  }

  return undefined;
}
