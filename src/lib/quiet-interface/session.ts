import { followVirtualEntry, getVirtualEntry } from "@/lib/quiet-interface/filesystem";
import {
  createInitialState,
  createReleasedState,
  type AfterimageProgress,
  type FailureCounts,
  type PuzzleMetrics,
  type PuzzleProgress,
  type QuietInterfaceState
} from "@/lib/quiet-interface/state";

export const QUIET_SESSION_STORAGE_KEY = "quiet-interface-state";
const SESSION_VERSION = 2;

type StoredQuietInterfaceStateV2 = {
  version: 2;
  progress: PuzzleProgress;
  cwd: string;
  hintsUsed: string[];
  failures: FailureCounts;
  commandCount: number;
  signalAttempts: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
}

function parseAfterimage(value: unknown): AfterimageProgress | undefined {
  if (value === "hidden" || value === "identified" || value === "decoded") return value;
  return undefined;
}

function parseProgress(value: unknown): PuzzleProgress | undefined {
  if (!isRecord(value) || typeof value.kind !== "string") return undefined;

  switch (value.kind) {
    case "dormant":
    case "decoding":
    case "signal-locked":
    case "image-built":
    case "image-verified":
    case "mounted":
    case "inside":
      return { kind: value.kind };
    case "observing": {
      const observation = value.observation;
      if (!isRecord(observation) || typeof observation.carrierRead !== "boolean" || typeof observation.traceRead !== "boolean") {
        return undefined;
      }
      if (observation.carrierRead && observation.traceRead) return { kind: "decoding" };
      if (observation.carrierRead) return { kind: "observing", observation: { carrierRead: true, traceRead: false } };
      if (observation.traceRead) return { kind: "observing", observation: { carrierRead: false, traceRead: true } };
      return { kind: "observing", observation: { carrierRead: false, traceRead: false } };
    }
    case "outside": {
      const afterimage = parseAfterimage(value.afterimage);
      return afterimage ? { kind: "outside", afterimage } : undefined;
    }
    default:
      return undefined;
  }
}

function parseFailures(value: unknown): FailureCounts | undefined {
  if (!isRecord(value)) return undefined;
  if (!isSafeCount(value.signal) || !isSafeCount(value.verification) || !isSafeCount(value.mount)) return undefined;
  return {
    signal: value.signal,
    verification: value.verification,
    mount: value.mount
  };
}

function parseHints(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((hint) => typeof hint === "string" && hint.length <= 64)) return undefined;
  return Array.from(new Set(value)).slice(0, 32);
}

function parseVersionTwo(value: unknown): StoredQuietInterfaceStateV2 | undefined {
  if (!isRecord(value) || value.version !== SESSION_VERSION || typeof value.cwd !== "string") return undefined;
  const progress = parseProgress(value.progress);
  const hintsUsed = parseHints(value.hintsUsed);
  const failures = parseFailures(value.failures);
  if (!progress || !hintsUsed || !failures || !isSafeCount(value.commandCount) || !isSafeCount(value.signalAttempts)) {
    return undefined;
  }

  return {
    version: SESSION_VERSION,
    progress,
    cwd: value.cwd,
    hintsUsed,
    failures,
    commandCount: value.commandCount,
    signalAttempts: value.signalAttempts
  };
}

function restoreVersionTwo(stored: StoredQuietInterfaceStateV2): QuietInterfaceState {
  const metrics: PuzzleMetrics = {
    commandCount: stored.commandCount,
    signalAttempts: stored.signalAttempts,
    failures: stored.failures,
    hintsUsed: stored.hintsUsed
  };
  const candidate: QuietInterfaceState = {
    progress: stored.progress,
    cwd: stored.cwd,
    metrics,
    commandHistory: []
  };
  const entry = followVirtualEntry(candidate, getVirtualEntry(candidate, candidate.cwd, "/"));
  const fallbackCwd = candidate.progress.kind === "dormant"
    ? "/"
    : candidate.progress.kind === "outside"
      ? "/outside"
      : "/surface";
  return entry?.kind === "directory" ? candidate : { ...candidate, cwd: fallbackCwd };
}

function restoreLegacy(value: unknown): QuietInterfaceState | undefined {
  if (!isRecord(value)) return undefined;
  return value.hasReleased === true ? createReleasedState() : undefined;
}

export function restoreQuietSession(storage: Storage): QuietInterfaceState {
  try {
    const stored = storage.getItem(QUIET_SESSION_STORAGE_KEY);
    if (!stored) return createInitialState();
    const parsed: unknown = JSON.parse(stored);
    const current = parseVersionTwo(parsed);
    if (current) return restoreVersionTwo(current);
    return restoreLegacy(parsed) ?? createInitialState();
  } catch {
    return createInitialState();
  }
}

export function persistQuietSession(storage: Storage, state: QuietInterfaceState): void {
  const payload: StoredQuietInterfaceStateV2 = {
    version: SESSION_VERSION,
    progress: state.progress,
    cwd: state.cwd,
    hintsUsed: state.metrics.hintsUsed,
    failures: state.metrics.failures,
    commandCount: state.metrics.commandCount,
    signalAttempts: state.metrics.signalAttempts
  };

  try {
    storage.setItem(QUIET_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // The interface remains usable when storage is unavailable or disabled.
  }
}

export function clearQuietSession(storage: Storage): void {
  try {
    storage.removeItem(QUIET_SESSION_STORAGE_KEY);
  } catch {
    // Reset still succeeds when storage is unavailable or disabled.
  }
}
