import type { QuietInterfaceState } from "@/lib/quiet-interface/state";

export const HINT_DELAY_MS = 900;

export function contextualHint(state: QuietInterfaceState) {
  if (!state.hasWoken) {
    return "try: help";
  }

  if (state.phase === "observation") {
    if (!state.hasListened) {
      return "next: cat carrier";
    }
    if (!state.hasTraced) {
      return "next: cat trace";
    }
    if (!state.hasDecodedSignal) {
      return "next: echo <token> > signal";
    }
    return "next: make signal";
  }

  if (state.phase === "assembly") {
    if (!state.hasDecodedSignal) {
      return "next: echo <token> > signal";
    }
    return "next: make signal";
  }

  if (state.phase === "boundary") {
    if (!state.boundaryOpen) {
      return "next: cd boundary";
    }
    if (!state.hasEntered) {
      return "next: cd inside";
    }
    return "next: ./release";
  }

  if (state.phase === "inside") {
    return "next: ./release";
  }

  return undefined;
}
