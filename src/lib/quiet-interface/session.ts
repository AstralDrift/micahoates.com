import { createInitialState, createReleasedState, type QuietInterfaceState } from "@/lib/quiet-interface/state";

const STORAGE_KEY = "quiet-interface-state";

type StoredQuietInterfaceState = {
  hasReleased?: boolean;
  lastPhase?: QuietInterfaceState["phase"];
};

export function restoreQuietSession(storage: Storage): QuietInterfaceState {
  const stored = storage.getItem(STORAGE_KEY);
  if (!stored) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(stored) as StoredQuietInterfaceState;
    return parsed.hasReleased ? createReleasedState() : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function persistQuietSession(storage: Storage, state: QuietInterfaceState) {
  if (!state.hasReleased) {
    return;
  }

  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      hasReleased: true,
      lastPhase: state.phase
    } satisfies StoredQuietInterfaceState)
  );
}

export function clearQuietSession(storage: Storage) {
  storage.removeItem(STORAGE_KEY);
}
