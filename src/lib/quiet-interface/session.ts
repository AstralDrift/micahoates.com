import {
  createInitialState,
  createReleasedState,
  type InterfacePhase,
  type QuietInterfaceState
} from "@/lib/quiet-interface/state";
import { EMPTY_TRACE_PROGRESS, progressFromState, type TraceProgress } from "@/lib/world-state";

const STORAGE_KEY = "quiet-interface-state";

const INTERFACE_PHASES: readonly InterfacePhase[] = [
  "dormant",
  "observation",
  "assembly",
  "boundary",
  "inside",
  "outside"
];

type StoredQuietInterfaceState = {
  hasReleased?: boolean;
  hasWoken?: boolean;
  hasDecodedSignal?: boolean;
  hasMadeSignal?: boolean;
  boundaryVisible?: boolean;
  lastPhase?: QuietInterfaceState["phase"];
};

function isInterfacePhase(value: unknown): value is InterfacePhase {
  return typeof value === "string" && (INTERFACE_PHASES as readonly string[]).includes(value);
}

export function restoreQuietSession(storage: Storage): QuietInterfaceState {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) {
      return createInitialState();
    }

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
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) {
      return EMPTY_TRACE_PROGRESS;
    }

    const parsed = JSON.parse(stored) as StoredQuietInterfaceState;
    if (parsed.hasReleased) {
      return progressFromState(createReleasedState());
    }

    return progressFromState({
      hasWoken: Boolean(parsed.hasWoken),
      hasDecodedSignal: Boolean(parsed.hasDecodedSignal),
      hasMadeSignal: Boolean(parsed.hasMadeSignal),
      boundaryVisible: Boolean(parsed.boundaryVisible),
      hasReleased: false,
      phase: isInterfacePhase(parsed.lastPhase) ? parsed.lastPhase : "dormant"
    });
  } catch {
    return EMPTY_TRACE_PROGRESS;
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

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // The interface remains fully usable when storage is unavailable or disabled.
  }
}

export function clearQuietSession(storage: Storage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Reset still succeeds when storage is unavailable or disabled.
  }
}
