import type { QuietInterfaceState, TerminalLine } from "@/lib/quiet-interface/state";

export type VirtualEntryKind = "directory" | "file" | "symlink" | "executable" | "device";

export type VirtualEntryId =
  | "root"
  | "readme"
  | "root-status"
  | "surface"
  | "carrier-link"
  | "carrier-sample"
  | "trace-link"
  | "trace-path"
  | "operator-log"
  | "fragment"
  | "signal"
  | "boundary"
  | "inside"
  | "release"
  | "outside"
  | "outside-contact"
  | "outside-record"
  | "outside-status"
  | "outside-surface-link";

export type VirtualEntry = {
  id: VirtualEntryId;
  path: string;
  name: string;
  kind: VirtualEntryKind;
  mode: string;
  size: number;
  target?: string;
  hidden?: boolean;
};

const ROOT_ENTRY: VirtualEntry = {
  id: "root",
  path: "/",
  name: "/",
  kind: "directory",
  mode: "dr-xr-xr-x",
  size: 96
};

function entry(
  id: VirtualEntryId,
  path: string,
  kind: VirtualEntryKind,
  mode: string,
  size: number,
  options: Pick<VirtualEntry, "target" | "hidden"> = {}
): VirtualEntry {
  return {
    id,
    path,
    name: path.split("/").filter(Boolean).at(-1) ?? "/",
    kind,
    mode,
    size,
    ...options
  };
}

export function virtualEntries(state: QuietInterfaceState): VirtualEntry[] {
  const entries: VirtualEntry[] = [
    ROOT_ENTRY,
    entry("readme", "/README", "file", "-r--r--r--", 132),
    entry("root-status", "/status", "device", "cr--r--r--", 0)
  ];

  if (state.hasWoken) {
    entries.push(
      entry("surface", "/surface", "directory", "dr-xr-xr-x", 160),
      entry("carrier-link", "/surface/carrier", "symlink", "lrwxrwxrwx", 14, { target: "carrier.sample" }),
      entry("carrier-sample", "/surface/carrier.sample", "file", "-r--r--r--", 34),
      entry("trace-link", "/surface/trace", "symlink", "lrwxrwxrwx", 10, { target: "trace.path" }),
      entry("trace-path", "/surface/trace.path", "file", "-r--r--r--", 20),
      entry("operator-log", "/surface/operator.log", "file", "-r--r-----", 176)
    );
  }

  if (state.hasListened && state.hasTraced) {
    entries.push(
      entry("fragment", "/surface/fragment", "file", "-r--r-----", 49),
      entry("signal", "/surface/signal", "device", state.hasDecodedSignal ? "-r--r--r--" : "-rw-r-----", state.hasDecodedSignal ? 5 : 0)
    );
  }

  if (state.boundaryVisible) {
    entries.push(entry("boundary", "/surface/boundary", "directory", "dr-x------", 64));
  }

  if (state.boundaryOpen) {
    entries.push(entry("inside", "/surface/boundary/inside", "directory", "dr-x------", 64));
  }

  if (state.hasEntered) {
    entries.push(entry("release", "/surface/boundary/inside/release", "executable", "-r-x------", 71));
  }

  if (state.hasReleased) {
    entries.push(
      entry("outside", "/outside", "directory", "dr-xr-xr-x", 128),
      entry("outside-contact", "/outside/contact", "file", "-r--r--r--", 54),
      entry("outside-record", "/outside/record", "file", "-r--r--r--", 118),
      entry("outside-status", "/outside/status", "device", "cr--r--r--", 0),
      entry("outside-surface-link", "/outside/.surface", "symlink", "lrwxrwxrwx", 8, {
        target: "/surface",
        hidden: true
      })
    );
  }

  return entries;
}

export function parentPath(path: string) {
  if (path === "/") {
    return "/";
  }

  const segments = path.split("/").filter(Boolean);
  segments.pop();
  return `/${segments.join("/")}` || "/";
}

function canonicalCase(path: string) {
  return path.toLowerCase() === "/readme" ? "/README" : path.toLowerCase();
}

export function resolveVirtualPath(cwd: string, rawPath: string) {
  const unquoted = rawPath.trim().replace(/^['"]|['"]$/g, "");
  if (!unquoted || unquoted === ".") {
    return cwd;
  }

  const expanded = unquoted === "~" ? "/surface" : unquoted.startsWith("~/") ? `/surface/${unquoted.slice(2)}` : unquoted;
  const segments = (expanded.startsWith("/") ? expanded : `${cwd}/${expanded}`).split("/");
  const resolved: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(segment.replace(/[/*]$/, ""));
  }

  return canonicalCase(`/${resolved.join("/")}` || "/");
}

export function getVirtualEntry(state: QuietInterfaceState, rawPath: string, cwd = state.cwd) {
  const path = resolveVirtualPath(cwd, rawPath);
  return virtualEntries(state).find((candidate) => canonicalCase(candidate.path) === canonicalCase(path));
}

export function followVirtualEntry(state: QuietInterfaceState, candidate: VirtualEntry | undefined) {
  if (!candidate || candidate.kind !== "symlink" || !candidate.target) {
    return candidate;
  }

  const targetPath = resolveVirtualPath(parentPath(candidate.path), candidate.target);
  return virtualEntries(state).find((entryCandidate) => canonicalCase(entryCandidate.path) === canonicalCase(targetPath));
}

export function directoryEntries(state: QuietInterfaceState, rawPath = state.cwd, includeHidden = false) {
  const directoryPath = resolveVirtualPath(state.cwd, rawPath);
  return virtualEntries(state)
    .filter((candidate) => candidate.path !== directoryPath && parentPath(candidate.path) === directoryPath)
    .filter((candidate) => includeHidden || !candidate.hidden)
    .sort((first, second) => {
      if (first.kind === "directory" && second.kind !== "directory") return -1;
      if (first.kind !== "directory" && second.kind === "directory") return 1;
      return first.name.localeCompare(second.name);
    });
}

export function displayName(candidate: VirtualEntry) {
  if (candidate.name === "." || candidate.name === "..") return candidate.name;
  if (candidate.kind === "directory") return `${candidate.name}/`;
  if (candidate.kind === "executable") return `${candidate.name}*`;
  if (candidate.kind === "symlink") return `${candidate.name}@`;
  return candidate.name;
}

function timestampFor(candidate: VirtualEntry) {
  if (candidate.id === "signal") return "Jun 20 00:04";
  if (candidate.id === "boundary" || candidate.id === "inside") return "Jun 20 00:05";
  if (candidate.id === "release") return "Jun 20 00:06";
  if (candidate.path.startsWith("/outside")) return "Jun 20 00:07";
  return "Jun 20 00:00";
}

export function listDirectoryLines(state: QuietInterfaceState, args: string): TerminalLine[] {
  const tokens = args.split(/\s+/).filter(Boolean);
  const flags = tokens.filter((token) => token.startsWith("-")).join("");
  const rawPath = tokens.find((token) => !token.startsWith("-")) ?? state.cwd;
  const long = flags.includes("l");
  const all = flags.includes("a");
  const directory = getVirtualEntry(state, rawPath);

  if (!directory) {
    return [{ text: `ls: ${rawPath}: no such file or directory`, tone: "error" }];
  }

  if (directory.kind !== "directory") {
    return [{ text: displayName(directory) }];
  }

  const rows = directoryEntries(state, directory.path, all);
  if (!long) {
    return rows.length > 0 ? rows.map((row) => ({ text: displayName(row) })) : [{ text: "(empty)", tone: "muted" }];
  }

  const dotRows: VirtualEntry[] = all
    ? [
        { ...directory, name: "." },
        { ...(getVirtualEntry(state, parentPath(directory.path)) ?? ROOT_ENTRY), name: ".." }
      ]
    : [];
  const longRows = [...dotRows, ...rows];

  return [
    { text: `total ${longRows.length}`, tone: "muted" },
    ...longRows.map((row) => ({
      text: `${row.mode}  1 operator surface ${String(row.size).padStart(4, " ")} ${timestampFor(row)} ${displayName(row)}${row.target ? ` -> ${row.target}` : ""}`
    }))
  ];
}

function treeLabel(candidate: VirtualEntry) {
  return `${displayName(candidate)}${candidate.target ? ` -> ${candidate.target}` : ""}`;
}

export function treeDirectoryLines(state: QuietInterfaceState, rawPath = state.cwd): TerminalLine[] {
  const root = getVirtualEntry(state, rawPath);
  if (!root) {
    return [{ text: `tree: ${rawPath}: no such file or directory`, tone: "error" }];
  }
  if (root.kind !== "directory") {
    return [{ text: treeLabel(root) }];
  }

  const lines: TerminalLine[] = [{ text: root.path === state.cwd ? "." : root.path }];

  const walk = (directory: VirtualEntry, prefix: string) => {
    const children = directoryEntries(state, directory.path, false);
    children.forEach((child, index) => {
      const last = index === children.length - 1;
      lines.push({ text: `${prefix}${last ? "`--" : "|--"} ${treeLabel(child)}` });
      if (child.kind === "directory") {
        walk(child, `${prefix}${last ? "    " : "|   "}`);
      }
    });
  };

  walk(root, "");
  return lines;
}

export function findDirectoryLines(state: QuietInterfaceState, rawPath = state.cwd): TerminalLine[] {
  const root = getVirtualEntry(state, rawPath);
  if (!root) {
    return [{ text: `find: ${rawPath}: no such file or directory`, tone: "error" }];
  }
  if (root.kind !== "directory") {
    return [{ text: root.path }];
  }

  const lines: TerminalLine[] = [{ text: root.path === state.cwd ? "." : root.path }];
  const walk = (directory: VirtualEntry) => {
    for (const child of directoryEntries(state, directory.path, false)) {
      const relative = root.path === "/" ? child.path : child.path.replace(root.path, ".");
      lines.push({ text: relative });
      if (child.kind === "directory") walk(child);
    }
  };
  walk(root);
  return lines;
}

export function pathSuggestionsForState(state: QuietInterfaceState) {
  const localEntries = directoryEntries(state, state.cwd, true).flatMap((candidate) => {
    const name = candidate.name;
    return candidate.kind === "directory" ? [`${name}/`, name] : [name];
  });
  const stablePaths = [".", "..", "/", "/README", "/status"];
  return Array.from(new Set([...localEntries, ...stablePaths]));
}

export function readlinkLine(state: QuietInterfaceState, rawPath: string): TerminalLine {
  if (!rawPath) {
    return { text: "readlink: missing operand", tone: "error" };
  }

  const candidate = getVirtualEntry(state, rawPath);
  if (!candidate) {
    return { text: `readlink: ${rawPath}: no such file or directory`, tone: "error" };
  }
  if (candidate.kind !== "symlink" || !candidate.target) {
    return { text: `readlink: ${rawPath}: invalid argument`, tone: "error" };
  }
  return { text: candidate.target };
}
