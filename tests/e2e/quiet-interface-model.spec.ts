import { expect, test } from "@playwright/test";

import { parseCommand, runQuietCommand } from "../../src/lib/quiet-interface/commands";
import { getVirtualEntry, listDirectoryLines } from "../../src/lib/quiet-interface/filesystem";
import { clearQuietSession, persistQuietSession, restoreQuietSession } from "../../src/lib/quiet-interface/session";
import { createInitialState, type QuietInterfaceState } from "../../src/lib/quiet-interface/state";

function run(state: QuietInterfaceState, command: string) {
  return runQuietCommand(command, state).nextState;
}

test("parser normalizes shell commands without inventing syntax", () => {
  expect(parseCommand("  SYSTEMCTL   START   interface ")).toEqual({
    command: "systemctl start interface",
    args: ""
  });
  expect(parseCommand("echo lumen > signal")).toEqual({
    command: "echo",
    args: "lumen > signal"
  });
  expect(parseCommand("./release")).toEqual({ command: "./release", args: "" });
});

test("virtual filesystem reflects every puzzle gate", () => {
  let state = createInitialState();
  expect(getVirtualEntry(state, "/surface")).toBeUndefined();

  state = run(state, "systemctl start interface");
  expect(state.cwd).toBe("/surface");
  expect(getVirtualEntry(state, "carrier")?.kind).toBe("symlink");
  expect(getVirtualEntry(state, "signal")).toBeUndefined();

  state = run(state, "cat carrier");
  state = run(state, "cat trace");
  expect(getVirtualEntry(state, "signal")?.mode).toBe("-rw-r-----");

  state = run(state, "echo lumen > signal");
  expect(state.hasDecodedSignal).toBe(true);
  expect(getVirtualEntry(state, "signal")?.mode).toBe("-r--r--r--");

  state = run(state, "make signal");
  expect(getVirtualEntry(state, "boundary")?.kind).toBe("directory");
  state = run(state, "cd boundary");
  expect(getVirtualEntry(state, "inside")?.kind).toBe("directory");
  state = run(state, "cd inside");
  expect(getVirtualEntry(state, "release")?.kind).toBe("executable");
});

test("navigation stays stable after opening directories", () => {
  let state = createInitialState();
  for (const command of [
    "systemctl start interface",
    "cat carrier",
    "cat trace",
    "echo lumen > signal",
    "make signal",
    "cd boundary",
    "cd inside"
  ]) {
    state = run(state, command);
  }

  const parentResult = runQuietCommand("cd ..", state);
  expect(parentResult.error).not.toBe(true);
  expect(parentResult.output).toEqual([]);
  expect(parentResult.nextState.cwd).toBe("/surface/boundary");
  expect(parentResult.nextState.boundaryOpen).toBe(true);
});

test("release only executes from the inside directory", () => {
  let state = createInitialState();
  for (const command of [
    "systemctl start interface",
    "cat carrier",
    "cat trace",
    "echo lumen > signal",
    "make signal",
    "cd boundary",
    "cd inside",
    "cd /"
  ]) {
    state = run(state, command);
  }

  const refused = runQuietCommand("./release", state);
  expect(refused.error).toBe(true);
  expect(refused.nextState.hasReleased).toBe(false);
  expect(refused.output[0]?.text).toBe("release has no surface here");

  state = run(state, "cd /surface/boundary/inside");
  const released = runQuietCommand("./release", state);
  expect(released.error).not.toBe(true);
  expect(released.nextState.hasReleased).toBe(true);
});

test("session storage is best-effort", () => {
  const unavailableStorage = {
    getItem() {
      throw new Error("storage unavailable");
    },
    setItem() {
      throw new Error("storage unavailable");
    },
    removeItem() {
      throw new Error("storage unavailable");
    }
  } as unknown as Storage;

  expect(restoreQuietSession(unavailableStorage).phase).toBe("dormant");
  const releasedState = run(
    {
      ...createInitialState(),
      hasEntered: true,
      cwd: "/surface/boundary/inside"
    },
    "./release"
  );
  expect(() => persistQuietSession(unavailableStorage, releasedState)).not.toThrow();
  expect(() => clearQuietSession(unavailableStorage)).not.toThrow();
});

test("released namespace exposes one hidden route back to the surface", () => {
  let state = createInitialState();
  for (const command of [
    "systemctl start interface",
    "cat carrier",
    "cat trace",
    "echo lumen > signal",
    "make signal",
    "cd boundary",
    "cd inside",
    "./release"
  ]) {
    state = run(state, command);
  }

  const normalListing = listDirectoryLines(state, "").map((line) => line.text).join("\n");
  const hiddenListing = listDirectoryLines(state, "-la").map((line) => line.text).join("\n");
  expect(normalListing).not.toContain(".surface");
  expect(hiddenListing).toContain(".surface@ -> /surface");
  expect(runQuietCommand("readlink .surface", state).output[0]?.text).toBe("/surface");
});
