import {
  createInitialState,
  createReleasedState,
  type QuietInterfaceState
} from "@/lib/quiet-interface/state";

const STORAGE_KEY = "quiet-interface-state";

type StoredQuietInterfaceState = {
  hasReleased?: boolean;
  lastPhase?: QuietInterfaceState["phase"];
};

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

export function persistQuietSession(storage: Storage, state: QuietInterfaceState) {
  if (!state.hasReleased) {
    return;
  }

  const payload: StoredQuietInterfaceState = {
    hasReleased: true,
    lastPhase: state.phase
  };

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
