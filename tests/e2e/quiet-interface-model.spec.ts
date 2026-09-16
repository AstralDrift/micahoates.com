import { expect, test } from "@playwright/test";

import { VISUAL_EVENT_DURATIONS_MS } from "../../src/lib/quiet-interface/canvas-model";
import { commandSuggestions, parseCommand, runQuietCommand } from "../../src/lib/quiet-interface/commands";
import { getVirtualEntry, listDirectoryLines } from "../../src/lib/quiet-interface/filesystem";
import { contextualHint } from "../../src/lib/quiet-interface/hints";
import { PUZZLE_SPEC } from "../../src/lib/quiet-interface/puzzle-spec";
import {
  QUIET_SESSION_STORAGE_KEY,
  clearQuietSession,
  persistQuietSession,
  restoreQuietSession
} from "../../src/lib/quiet-interface/session";
import {
  createInitialState,
  hasDecodedSignal,
  hasMountedBoundary,
  hasReadCarrier,
  hasReadTrace,
  hasReleased,
  hasVerifiedImage,
  type QuietInterfaceState
} from "../../src/lib/quiet-interface/state";

function run(state: QuietInterfaceState, command: string): QuietInterfaceState {
  return runQuietCommand(command, state).nextState;
}

function startInterface(): QuietInterfaceState {
  return run(createInitialState(), "systemctl start interface");
}

function decodeSignal(): QuietInterfaceState {
  let state = startInterface();
  for (const command of ["cat carrier", "cat trace", "echo lumen > signal"]) state = run(state, command);
  return state;
}

function buildImage(): QuietInterfaceState {
  return run(decodeSignal(), "make signal");
}

function verifyImage(): QuietInterfaceState {
  return run(buildImage(), "sha256sum -c boundary.img.sha256");
}

function mountImage(): QuietInterfaceState {
  return run(verifyImage(), "mount -o ro boundary.img /mnt/boundary");
}

function releaseInterface(): QuietInterfaceState {
  let state = mountImage();
  state = run(state, "cd /mnt/boundary/inside");
  return run(state, "./release");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}

test("parser keeps Linux syntax and removes legacy command aliases", () => {
  expect(parseCommand("  SYSTEMCTL   START   interface ")).toEqual({ command: "systemctl start interface", args: "" });
  expect(parseCommand("echo lumen > signal")).toEqual({ command: "echo", args: "lumen > signal" });
  expect(parseCommand("sha256sum -c boundary.img.sha256")).toEqual({ command: "sha256sum", args: "-c boundary.img.sha256" });
  expect(parseCommand("mount -o ro boundary.img /mnt/boundary")).toEqual({ command: "mount", args: "-o ro boundary.img /mnt/boundary" });
  expect(parseCommand("./release")).toEqual({ command: "./release", args: "" });
  expect(parseCommand("open boundary")).toEqual({ command: "open", args: "boundary" });
  expect(parseCommand("release")).toEqual({ command: "release", args: "" });
});

test("progression visits every boundary-image variant in order", () => {
  let state = createInitialState();
  expect(state.progress.kind).toBe("dormant");

  state = run(state, "systemctl start interface");
  expect(state.progress.kind).toBe("observing");
  state = run(state, "cat carrier");
  expect(state.progress.kind).toBe("observing");
  expect(hasReadCarrier(state)).toBe(true);
  expect(hasReadTrace(state)).toBe(false);
  state = run(state, "cat trace");
  expect(state.progress.kind).toBe("decoding");
  state = run(state, "echo lumen > signal");
  expect(state.progress.kind).toBe("signal-locked");
  state = run(state, "make signal");
  expect(state.progress.kind).toBe("image-built");
  state = run(state, "sha256sum -c boundary.img.sha256");
  expect(state.progress.kind).toBe("image-verified");
  state = run(state, "mount -o ro boundary.img /mnt/boundary");
  expect(state.progress.kind).toBe("mounted");
  state = run(state, "cd /mnt/boundary/inside");
  expect(state.progress.kind).toBe("inside");
  state = run(state, "./release");
  expect(state.progress.kind).toBe("outside");
});

test("virtual filesystem reflects every gate without exposing release early", () => {
  let state = createInitialState();
  expect(getVirtualEntry(state, "/surface")).toBeUndefined();
  expect(getVirtualEntry(state, "/mnt")?.kind).toBe("directory");

  state = startInterface();
  expect(state.cwd).toBe("/surface");
  expect(getVirtualEntry(state, "carrier")?.kind).toBe("symlink");
  expect(getVirtualEntry(state, "signal")).toBeUndefined();

  state = run(state, "cat trace");
  state = run(state, "cat carrier");
  expect(getVirtualEntry(state, "signal")?.mode).toBe("-rw-r-----");
  state = run(state, "echo lumen > signal");
  expect(hasDecodedSignal(state)).toBe(true);
  expect(getVirtualEntry(state, "signal")?.mode).toBe("-r--r--r--");

  state = run(state, "make signal");
  expect(getVirtualEntry(state, "boundary.img")?.kind).toBe("image");
  expect(getVirtualEntry(state, "boundary.img.sha256")?.kind).toBe("file");
  expect(getVirtualEntry(state, "boundary")?.target).toBe("/mnt/boundary");
  expect(getVirtualEntry(state, "/mnt/boundary")).toBeUndefined();
  expect(getVirtualEntry(state, "/mnt/boundary/inside/release")).toBeUndefined();

  state = run(state, "sha256sum -c boundary.img.sha256");
  expect(getVirtualEntry(state, "/mnt/boundary")).toBeUndefined();
  state = run(state, "mount boundary.img /mnt/boundary");
  expect(getVirtualEntry(state, "/mnt/boundary")?.kind).toBe("directory");
  expect(getVirtualEntry(state, "/mnt/boundary/inside")?.kind).toBe("directory");
  expect(getVirtualEntry(state, "/mnt/boundary/inside/release")?.kind).toBe("executable");
});

test("signal writes preserve wrong-write behavior and first-attempt metrics", () => {
  let state = startInterface();
  const refused = runQuietCommand("echo lumen > signal", state);
  expect(refused.error).toBe(true);
  expect(refused.output[0]?.text).toBe("signal: write refused");

  state = run(state, "cat carrier");
  state = run(state, "cat trace");
  const wrong = runQuietCommand("echo dark > signal", state);
  expect(wrong.error).toBe(true);
  expect(wrong.nextState.metrics.signalAttempts).toBe(1);
  expect(wrong.nextState.metrics.failures.signal).toBe(1);
  expect(wrong.output[0]?.text).toBe("signal: write error: checksum mismatch");

  const correct = runQuietCommand("echo lumen > signal", wrong.nextState);
  expect(correct.error).not.toBe(true);
  expect(correct.nextState.metrics.signalAttempts).toBe(2);
  expect(correct.nextState.progress.kind).toBe("signal-locked");
  expect(runQuietCommand("echo lumen > signal", correct.nextState).output[0]?.text).toBe("signal: read-only filesystem");
});

test("commands cannot skip a progression gate", () => {
  let decoding = startInterface();
  decoding = run(decoding, "cat carrier");
  decoding = run(decoding, "cat trace");

  const cases: Array<{ state: QuietInterfaceState; command: string; phase: QuietInterfaceState["progress"]["kind"] }> = [
    { state: decoding, command: "make signal", phase: "decoding" },
    { state: decodeSignal(), command: "sha256sum -c boundary.img.sha256", phase: "signal-locked" },
    { state: buildImage(), command: "mount boundary.img /mnt/boundary", phase: "image-built" },
    { state: verifyImage(), command: "cd /mnt/boundary/inside", phase: "image-verified" },
    { state: mountImage(), command: "./release", phase: "mounted" }
  ];

  for (const item of cases) {
    const result = runQuietCommand(item.command, item.state);
    expect(result.error).toBe(true);
    expect(result.nextState.progress.kind).toBe(item.phase);
  }
});

test("build, verify, and mount are stable under repeated execution", () => {
  const built = buildImage();
  const rebuilt = runQuietCommand("make signal", built);
  expect(rebuilt.error).not.toBe(true);
  expect(rebuilt.nextState.progress.kind).toBe("image-built");
  expect(rebuilt.output[0]?.text).toBe("make: 'signal' is up to date.");

  const verified = runQuietCommand("sha256sum -c boundary.img.sha256", rebuilt.nextState);
  expect(verified.output[0]?.text).toBe("boundary.img: OK");
  const reverified = runQuietCommand("sha256sum -c boundary.img.sha256", verified.nextState);
  expect(reverified.error).not.toBe(true);
  expect(reverified.nextState.progress.kind).toBe("image-verified");

  const mounted = runQuietCommand("mount boundary.img /mnt/boundary", reverified.nextState);
  expect(mounted.nextState.progress.kind).toBe("mounted");
  const duplicate = runQuietCommand("mount boundary.img /mnt/boundary", mounted.nextState);
  expect(duplicate.error).toBe(true);
  expect(duplicate.nextState.progress.kind).toBe("mounted");
  expect(duplicate.output[0]?.text).toBe("mount: /mnt/boundary: already mounted");
});

test("sha256sum hashes the deterministic payload and verifies only its manifest", () => {
  const state = buildImage();
  const hash = runQuietCommand("sha256sum boundary.img", state);
  expect(hash.output[0]?.text).toBe(`${PUZZLE_SPEC.image.checksum}  boundary.img`);

  const wrongManifest = runQuietCommand("sha256sum -c boundary.img", state);
  expect(wrongManifest.error).toBe(true);
  expect(wrongManifest.nextState.metrics.failures.verification).toBe(1);
  expect(wrongManifest.output[0]?.text).toContain("no properly formatted checksum lines found");

  const verified = runQuietCommand("sha256sum -c /surface/boundary.img.sha256", wrongManifest.nextState);
  expect(verified.error).not.toBe(true);
  expect(verified.output[0]?.text).toBe("boundary.img: OK");
  expect(hasVerifiedImage(verified.nextState)).toBe(true);
});

test("mount accepts relative and absolute paths but refuses unsafe transitions", () => {
  const built = buildImage();
  const unverified = runQuietCommand("mount boundary.img ../mnt/boundary", built);
  expect(unverified.error).toBe(true);
  expect(unverified.output[0]?.text).toContain("image has not been verified");
  expect(unverified.nextState.metrics.failures.mount).toBe(1);

  const verified = run(unverified.nextState, "sha256sum -c boundary.img.sha256");
  expect(runQuietCommand("mount -o rw boundary.img /mnt/boundary", verified).output[0]?.text).toBe("mount: only read-only mode is supported");
  expect(runQuietCommand("mount boundary.img /tmp/boundary", verified).output[0]?.text).toContain("invalid mount point");
  expect(runQuietCommand("mount signal /mnt/boundary", verified).output[0]?.text).toContain("unknown image");

  const mounted = runQuietCommand("mount -o ro /surface/boundary.img /mnt/boundary", verified);
  expect(mounted.error).not.toBe(true);
  expect(hasMountedBoundary(mounted.nextState)).toBe(true);
});

test("release requires the mounted inside directory and prints the ceremony record", () => {
  let state = mountImage();
  const outsideAttempt = runQuietCommand("./release", state);
  expect(outsideAttempt.error).toBe(true);
  expect(outsideAttempt.output[0]?.text).toBe("release has no surface here");

  state = run(state, "cd boundary");
  expect(state.cwd).toBe("/mnt/boundary");
  state = run(state, "cd inside");
  expect(state.cwd).toBe(PUZZLE_SPEC.image.insidePath);
  const released = runQuietCommand("./release", state);
  const text = released.output.map((line) => line.text);
  expect(released.error).not.toBe(true);
  expect(hasReleased(released.nextState)).toBe(true);
  expect(text).toContain("congratulations, operator");
  expect(text).toContain("you found the outside");
  expect(text).toContain("contact: micah [at] nexusneural [dot] net");
  expect(text).toContain("signal integrity: unbroken");
  expect(text).toContain("  signal attempts: 1");
});

test("removed fake verbs are neither executable nor suggested", () => {
  const state = decodeSignal();
  const suggestions = commandSuggestions(state);
  for (const legacy of ["listen", "trace", "align", "open boundary", "enter", "release"]) {
    expect(suggestions).not.toContain(legacy);
    expect(runQuietCommand(legacy, state).output[0]?.text).toContain("command not found");
  }
  expect(runQuietCommand("whoami", state).output[0]?.text).toBe("operator identity:");
  expect(runQuietCommand("sudo release", state).output[0]?.text).toBe("permission model rejected");
  expect(runQuietCommand("exit", state).output[0]?.text).toBe("no enclosing shell detected");
});

test("outside detaches the boundary and does not advertise release again", () => {
  const state = releaseInterface();
  expect(getVirtualEntry(state, "/mnt/boundary")).toBeUndefined();
  expect(commandSuggestions(state)).not.toContain("./release");

  const remount = runQuietCommand("mount boundary.img /mnt/boundary", run(state, "cd /surface"));
  expect(remount.error).toBe(true);
  expect(remount.nextState.progress.kind).toBe("outside");
  expect(remount.output[0]?.text).toContain("outside namespace is final");
});

test("only puzzle-solving prompts count as assistance", () => {
  expect(contextualHint(createInitialState())?.countsTowardSolve).toBe(false);

  let decoding = startInterface();
  decoding = run(decoding, "cat carrier");
  decoding = run(decoding, "cat trace");
  expect(contextualHint(decoding)?.countsTowardSolve).toBe(true);
  expect(contextualHint(decodeSignal())?.countsTowardSolve).toBe(false);
});

test("the hidden afterimage unlocks xxd only after file inspection", () => {
  let state = releaseInterface();
  const normalListing = listDirectoryLines(state, "").map((line) => line.text).join("\n");
  const hiddenListing = listDirectoryLines(state, "-la").map((line) => line.text).join("\n");
  expect(normalListing).not.toContain(".afterimage");
  expect(hiddenListing).toContain(".afterimage");
  expect(commandSuggestions(state)).not.toContain("xxd");
  expect(runQuietCommand("xxd -r -p .afterimage", state).output[0]?.text).toContain("command not found");

  const identified = runQuietCommand("file .afterimage", state);
  state = identified.nextState;
  expect(identified.output[0]?.text).toContain("hexadecimal bytes");
  expect(commandSuggestions(state)).toContain("xxd");
  const decoded = runQuietCommand("xxd -p -r .afterimage", state);
  expect(decoded.output[0]?.text).toBe(PUZZLE_SPEC.epilogue.text);
  expect(decoded.nextState.progress).toEqual({ kind: "outside", afterimage: "decoded" });
});

test("versioned persistence restores partial progress without history", () => {
  const storage = memoryStorage();
  let state = startInterface();
  state = run(state, "cat carrier");
  state = run(state, "cat trace");
  state = run(state, "echo dark > signal");
  persistQuietSession(storage, state);

  const stored: unknown = JSON.parse(storage.getItem(QUIET_SESSION_STORAGE_KEY) ?? "{}");
  if (!isRecord(stored)) throw new Error("stored session is not an object");
  expect(stored.version).toBe(2);
  expect(stored.progress).toEqual({ kind: "decoding" });
  expect(stored.cwd).toBe("/surface");
  expect(stored.signalAttempts).toBe(1);
  expect(stored.failures).toEqual({ signal: 1, verification: 0, mount: 0 });
  expect(stored).not.toHaveProperty("commandHistory");
  expect(stored).not.toHaveProperty("input");

  const restored = restoreQuietSession(storage);
  expect(restored.progress.kind).toBe("decoding");
  expect(restored.metrics.signalAttempts).toBe(1);
  expect(restored.commandHistory).toEqual([]);
});

test("persistence migrates released sessions and rejects invalid state", () => {
  const legacy = memoryStorage({
    [QUIET_SESSION_STORAGE_KEY]: JSON.stringify({ hasReleased: true, lastPhase: "outside" })
  });
  expect(restoreQuietSession(legacy).progress).toEqual({ kind: "outside", afterimage: "hidden" });

  const invalid = memoryStorage({
    [QUIET_SESSION_STORAGE_KEY]: JSON.stringify({
      version: 2,
      progress: { kind: "mounted" },
      cwd: "/not-real",
      hintsUsed: [],
      failures: { signal: 0, verification: 0, mount: 0 },
      commandCount: 7,
      signalAttempts: 1
    })
  });
  const restored = restoreQuietSession(invalid);
  expect(restored.progress.kind).toBe("mounted");
  expect(restored.cwd).toBe("/surface");

  const invalidOutside = memoryStorage({
    [QUIET_SESSION_STORAGE_KEY]: JSON.stringify({
      version: 2,
      progress: { kind: "outside", afterimage: "hidden" },
      cwd: "/mnt/boundary/inside",
      hintsUsed: [],
      failures: { signal: 0, verification: 0, mount: 0 },
      commandCount: 8,
      signalAttempts: 1
    })
  });
  expect(restoreQuietSession(invalidOutside).cwd).toBe("/outside");
});

test("session storage stays best-effort and reset clears it", () => {
  const unavailableStorage: Storage = {
    get length(): number {
      throw new Error("storage unavailable");
    },
    clear() {
      throw new Error("storage unavailable");
    },
    getItem() {
      throw new Error("storage unavailable");
    },
    key() {
      throw new Error("storage unavailable");
    },
    setItem() {
      throw new Error("storage unavailable");
    },
    removeItem() {
      throw new Error("storage unavailable");
    }
  };

  expect(restoreQuietSession(unavailableStorage).progress.kind).toBe("dormant");
  expect(() => persistQuietSession(unavailableStorage, releaseInterface())).not.toThrow();
  expect(() => clearQuietSession(unavailableStorage)).not.toThrow();

  const available = memoryStorage();
  persistQuietSession(available, buildImage());
  expect(available.length).toBe(1);
  clearQuietSession(available);
  expect(available.length).toBe(0);
});

test("released namespace exposes hidden surface and afterimage entries", () => {
  const state = releaseInterface();
  const normalListing = listDirectoryLines(state, "").map((line) => line.text).join("\n");
  const hiddenListing = listDirectoryLines(state, "-la").map((line) => line.text).join("\n");
  expect(normalListing).not.toContain(".surface");
  expect(normalListing).not.toContain(".afterimage");
  expect(hiddenListing).toContain(".surface@ -> /surface");
  expect(hiddenListing).toContain(".afterimage");
  expect(runQuietCommand("readlink .surface", state).output[0]?.text).toBe("/surface");
});

test("milestone envelopes use the specified durations", () => {
  expect(VISUAL_EVENT_DURATIONS_MS.boot).toBe(700);
  expect(VISUAL_EVENT_DURATIONS_MS["signal-lock"]).toBe(500);
  expect(VISUAL_EVENT_DURATIONS_MS["image-build"]).toBe(1_100);
  expect(VISUAL_EVENT_DURATIONS_MS["image-verify"]).toBe(800);
  expect(VISUAL_EVENT_DURATIONS_MS.mount).toBe(1_400);
  expect(VISUAL_EVENT_DURATIONS_MS.enter).toBe(900);
  expect(VISUAL_EVENT_DURATIONS_MS.release).toBe(1_800);
});
