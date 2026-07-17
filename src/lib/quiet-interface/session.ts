import { createInitialState, createReleasedState, type QuietInterfaceState } from "@/lib/quiet-interface/state";
import { progressFromState, type TraceProgress } from "@/lib/world-state";

const STORAGE_KEY = "quiet-interface-state";

type StoredQuietInterfaceState = {
  hasReleased?: boolean;
  hasWoken?: boolean;
  hasDecodedSignal?: boolean;
  hasMadeSignal?: boolean;
  boundaryVisible?: boolean;
  lastPhase?: QuietInterfaceState["phase"];
};

export function restoreQuietSession(storage: Storage): QuietInterfaceState {
  const stored = storage.getItem(STORAGE_KEY);
  if (!stored) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(stored) as StoredQuietInterfaceState;
    if (parsed.hasReleased) {
      return createReleasedState();
    }

    return createInitialState();
  } catch {
    return createInitialState();
  }
}

/** Lightweight progress for brand schematic lighting (survives before full release). */
export function restoreTraceProgress(storage: Storage): TraceProgress {
  const empty: TraceProgress = {
    carrier: false,
    signal: false,
    boundary: false,
    release: false
  };

  const stored = storage.getItem(STORAGE_KEY);
  if (!stored) {
    return empty;
  }

  try {
    const parsed = JSON.parse(stored) as StoredQuietInterfaceState;
    if (parsed.hasReleased) {
      return progressFromState(createReleasedState());
    }

    return {
      carrier: Boolean(parsed.hasWoken),
      signal: Boolean(parsed.hasDecodedSignal || parsed.hasMadeSignal),
      boundary: Boolean(parsed.boundaryVisible),
      release: false
    };
  } catch {
    return empty;
  }
}

export function persistQuietSession(storage: Storage, state: QuietInterfaceState) {
  const payload: StoredQuietInterfaceState = {
    hasReleased: state.hasReleased,
    hasWoken: state.hasWoken,
    hasDecodedSignal: state.hasDecodedSignal,
    hasMadeSignal: state.hasMadeSignal,
    boundaryVisible: state.boundaryVisible,
    lastPhase: state.phase
  };

  // Persist once the operator has woken — enough to light the schematic later.
  if (!state.hasWoken && !state.hasReleased) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearQuietSession(storage: Storage) {
  storage.removeItem(STORAGE_KEY);
}
