"use client";

import { CornerDownLeft } from "lucide-react";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  aiAreas,
  automationAreas,
  capabilitySignals,
  commands,
  site,
  stackGroups,
  systemNodes,
  terminalBootLines,
  type CommandKey
} from "@/lib/site-content";

type TerminalPanelProps = {
  commandRequest: { command: CommandKey; id: number } | null;
};

type TerminalLine = {
  id: string;
  kind: "input" | "output" | "system";
  content: ReactNode;
};

const commandLabels = commands.map((command) => command.label);

function TerminalBlock({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.025] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function BootOutput() {
  return (
    <div className="space-y-1 text-slate-500">
      {terminalBootLines.map((line) => (
        <p key={line}>
          <span className="text-cyan-300">[ok]</span> {line}
        </p>
      ))}
    </div>
  );
}

function HelpOutput() {
  return (
    <div className="space-y-3">
      <p className="text-slate-400">Available commands:</p>
      <dl className="grid gap-2 sm:grid-cols-[8rem_1fr]">
        {commands.map((command) => (
          <div key={command.key} className="contents">
            <dt className="text-emerald-300">{command.label}</dt>
            <dd className="text-slate-400">{command.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AboutOutput() {
  return (
    <TerminalBlock title="about">
      <p className="max-w-3xl leading-8 text-slate-300">{site.description}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {capabilitySignals.map((signal) => {
          const Icon = signal.icon;
          return (
            <div key={signal.label} className="border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-2 text-emerald-300">
                <Icon className="size-4" aria-hidden="true" />
                <span>{signal.label}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{signal.value}</p>
            </div>
          );
        })}
      </div>
    </TerminalBlock>
  );
}

function StackOutput() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {stackGroups.map((group) => {
        const Icon = group.icon;
        return (
          <div key={group.label} className="border border-white/10 bg-white/[0.025] p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <Icon className="size-4" aria-hidden="true" />
              <p>{group.label}</p>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-400">{group.items.join(" / ")}</p>
          </div>
        );
      })}
    </div>
  );
}

function SystemsOutput() {
  return (
    <TerminalBlock title="systems map">
      <div className="hidden overflow-x-auto pb-2 text-xs leading-6 text-slate-400 sm:block" aria-hidden="true">
        <pre>{`Software ───── Cloud ───── DevOps/SRE
   │             │             │
   └────── AI ───┴── Automation ┘`}</pre>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {systemNodes.map((node) => {
          const Icon = node.icon;
          return (
            <div key={node.label} className="border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-2 text-emerald-300">
                <Icon className="size-4" aria-hidden="true" />
                <span>{node.label}</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">/{node.note}</p>
            </div>
          );
        })}
      </div>
    </TerminalBlock>
  );
}

function AutomationOutput() {
  return (
    <TerminalBlock title="automation">
      <ul className="grid gap-2 sm:grid-cols-2">
        {automationAreas.map((item) => (
          <li key={item} className="border border-white/10 bg-black/20 px-3 py-2 text-slate-400">
            <span className="mr-2 text-emerald-300">&gt;</span>
            {item}
          </li>
        ))}
      </ul>
    </TerminalBlock>
  );
}

function AiOutput() {
  return (
    <TerminalBlock title="ai-enabled systems">
      <ul className="grid gap-2 sm:grid-cols-2">
        {aiAreas.map((item) => (
          <li key={item} className="border border-white/10 bg-black/20 px-3 py-2 text-slate-400">
            <span className="mr-2 text-violet-300">*</span>
            {item}
          </li>
        ))}
      </ul>
    </TerminalBlock>
  );
}

function createOutput(command: CommandKey): ReactNode {
  switch (command) {
    case "help":
      return <HelpOutput />;
    case "about":
      return <AboutOutput />;
    case "stack":
      return <StackOutput />;
    case "systems":
      return <SystemsOutput />;
    case "automation":
      return <AutomationOutput />;
    case "ai":
      return <AiOutput />;
    case "clear":
      return null;
    default:
      return null;
  }
}

function normalizeCommand(value: string): CommandKey | null {
  const next = value.trim().toLowerCase();
  if (commandLabels.includes(next)) {
    return next as CommandKey;
  }
  return null;
}

function createOpeningLines(): TerminalLine[] {
  return [
    {
      id: "boot-output",
      kind: "system",
      content: <BootOutput />
    },
    {
      id: "initial-input",
      kind: "input",
      content: "help"
    },
    {
      id: "initial-output",
      kind: "output",
      content: <HelpOutput />
    }
  ];
}

export function TerminalPanel({ commandRequest }: TerminalPanelProps) {
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>(() => createOpeningLines());
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const lineCounterRef = useRef(0);
  const seenRequestId = useRef<number | null>(null);

  const nextLineId = useCallback((label: string) => {
    lineCounterRef.current += 1;
    return `${label}-${lineCounterRef.current}`;
  }, []);

  const scrollToBottom = useCallback(() => {
    const output = outputRef.current;
    if (!output) {
      return;
    }

    window.requestAnimationFrame(() => {
      output.scrollTop = output.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  const rememberCommand = useCallback((value: string) => {
    if (!value) {
      return;
    }

    setHistory((current) => (current[current.length - 1] === value ? current : [...current, value]));
    setHistoryIndex(null);
  }, []);

  const runCommand = useCallback(
    (command: CommandKey, submittedValue: string = command) => {
      rememberCommand(submittedValue);

      if (command === "clear") {
        setLines(createOpeningLines());
        setInput("");
        return;
      }

      setLines((current) => [
        ...current,
        {
          id: nextLineId(`${command}-input`),
          kind: "input",
          content: submittedValue
        },
        {
          id: nextLineId(`${command}-output`),
          kind: "output",
          content: createOutput(command)
        }
      ]);
      setInput("");
    },
    [nextLineId, rememberCommand]
  );

  useEffect(() => {
    if (!commandRequest || seenRequestId.current === commandRequest.id) {
      return;
    }

    seenRequestId.current = commandRequest.id;
    runCommand(commandRequest.command);
    document.getElementById("terminal")?.scrollIntoView({ behavior: "smooth", block: "center" });
    inputRef.current?.focus();
  }, [commandRequest, runCommand]);

  const submitInput = useCallback(() => {
    const submittedValue = input.trim();
    const command = normalizeCommand(submittedValue);

    if (!command) {
      rememberCommand(submittedValue);
      setLines((current) => [
        ...current,
        {
          id: nextLineId("unknown-input"),
          kind: "input",
          content: submittedValue || " "
        },
        {
          id: nextLineId("unknown-output"),
          kind: "output",
          content: (
            <p className="text-slate-400">
              Unknown command. Try <span className="text-emerald-300">help</span>.
            </p>
          )
        }
      ]);
      setInput("");
      return;
    }

    runCommand(command, submittedValue);
  }, [input, nextLineId, rememberCommand, runCommand]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitInput();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitInput();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) {
        return;
      }
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex]);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (history.length === 0 || historyIndex === null) {
        return;
      }
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setInput("");
        return;
      }
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex]);
    }
  };

  return (
    <section
      id="terminal"
      data-terminal-panel="true"
      aria-label="Interactive terminal"
      className="panel-border scanline flex h-[min(70svh,48rem)] min-h-[30rem] scroll-mt-4 flex-col overflow-hidden sm:h-[min(76svh,48rem)] sm:min-h-[34rem]"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm text-emerald-300">mo@workstation:~</p>
        <div className="flex items-center gap-3 text-slate-500" aria-hidden="true">
          <span>+</span>
          <span>▢</span>
          <span>⚙</span>
          <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(113,243,177,0.7)]" />
        </div>
      </div>

      <div ref={outputRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 text-sm sm:px-6 sm:text-base">
        {lines.map((line) => (
          <div
            key={line.id}
            className={
              line.kind === "input" ? "text-slate-100" : line.kind === "system" ? "text-slate-500" : "pl-5 text-slate-300"
            }
          >
            {line.kind === "input" ? (
              <p>
                <span className="mr-2 text-emerald-300">&gt;</span>
                {line.content}
              </p>
            ) : (
              line.content
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-white/10 bg-black/24 px-4 py-4 sm:px-6">
        <label htmlFor="terminal-input" className="sr-only">
          Terminal command
        </label>
        <span className="text-emerald-300">&gt;</span>
        <input
          ref={inputRef}
          id="terminal-input"
          data-terminal-input="true"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setHistoryIndex(null);
          }}
          onKeyDown={handleInputKeyDown}
          autoComplete="off"
          spellCheck={false}
          placeholder="type a command"
          className="min-w-0 flex-1 bg-transparent text-slate-100 caret-emerald-300 outline-none placeholder:text-slate-600"
        />
        <button
          type="submit"
          className="grid size-9 place-items-center border border-emerald-300/35 text-emerald-200 transition hover:border-emerald-200 hover:bg-emerald-300/10"
          aria-label="Run terminal command"
        >
          <CornerDownLeft className="size-4" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
