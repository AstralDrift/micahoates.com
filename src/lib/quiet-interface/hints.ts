import { hasReadCarrier, hasReadTrace, type QuietInterfaceState } from "@/lib/quiet-interface/state";

export const HINT_DELAY_MS = 2_600;

export type ContextualHint = {
  id: string;
  text: string;
  countsTowardSolve: boolean;
};

function progressiveHint({
  gate,
  failures,
  objectHint,
  manual,
  syntax
}: {
  gate: string;
  failures: number;
  objectHint: string;
  manual: string;
  syntax: string;
}): ContextualHint {
  if (failures >= 3) return { id: `${gate}-syntax`, text: syntax, countsTowardSolve: true };
  if (failures >= 2) return { id: `${gate}-manual`, text: `manual: man ${manual}`, countsTowardSolve: true };
  return { id: `${gate}-object`, text: objectHint, countsTowardSolve: true };
}

export function contextualHint(state: QuietInterfaceState): ContextualHint | undefined {
  switch (state.progress.kind) {
    case "dormant":
      return {
        id: "boot",
        text: state.commandHistory.includes("help") ? "interface.service is inactive" : "try: help",
        countsTowardSolve: false
      };
    case "observing":
      if (!hasReadCarrier(state)) return { id: "carrier", text: "carrier -> carrier.sample", countsTowardSolve: false };
      if (!hasReadTrace(state)) return { id: "trace", text: "trace -> trace.path", countsTowardSolve: false };
      return undefined;
    case "decoding":
      return progressiveHint({
        gate: "signal",
        failures: state.metrics.failures.signal,
        objectHint: "signal is writable; decoded token required",
        manual: "echo",
        syntax: "try: echo <decoded-token> > signal"
      });
    case "signal-locked":
      return { id: "build", text: "make target: signal", countsTowardSolve: false };
    case "image-built":
      return progressiveHint({
        gate: "verification",
        failures: state.metrics.failures.verification,
        objectHint: "boundary.img has an unverified manifest",
        manual: "sha256sum",
        syntax: "try: sha256sum -c boundary.img.sha256"
      });
    case "image-verified":
      return progressiveHint({
        gate: "mount",
        failures: state.metrics.failures.mount,
        objectHint: "boundary.img is verified but not mounted",
        manual: "mount",
        syntax: "try: mount -o ro boundary.img /mnt/boundary"
      });
    case "mounted":
      return { id: "enter", text: "mounted namespace: /mnt/boundary/inside", countsTowardSolve: false };
    case "inside":
      return { id: "release", text: "release is executable", countsTowardSolve: false };
    case "outside":
      return undefined;
    default: {
      const exhaustive: never = state.progress;
      return exhaustive;
    }
  }
}
