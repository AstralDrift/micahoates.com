"use client";

import { motion } from "framer-motion";
import { TerminalSquare } from "lucide-react";

import { TerminalPanel } from "@/components/terminal-panel";
import { site, type CommandKey } from "@/lib/site-content";

type HeroSectionProps = {
  commandRequest: { command: CommandKey; id: number } | null;
  onOpenCommandMenu: () => void;
};

export function HeroSection({ commandRequest, onOpenCommandMenu }: HeroSectionProps) {
  return (
    <section id="top" className="relative min-h-screen py-4 sm:py-10">
      <div className="page-rail grid min-h-[calc(100svh-2rem)] items-start gap-5 pt-2 sm:gap-8 sm:pt-0 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="corner-frame max-w-3xl px-3 py-4 sm:px-8 sm:py-6 lg:px-5"
        >
          <h1 className="max-w-none text-4xl font-semibold leading-[0.96] tracking-normal text-white sm:text-6xl xl:text-7xl 2xl:text-[5.4rem]">
            {site.name}
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-base leading-7 text-emerald-200 sm:mt-7 sm:text-2xl sm:leading-relaxed">
            {site.heroTagline}
          </p>
          <div className="mt-4 h-1 w-16 bg-gradient-to-r from-cyan-300 via-emerald-300 to-violet-400 sm:mt-7" aria-hidden="true" />
          <p className="mt-4 max-w-xl text-pretty text-sm leading-6 text-slate-300 sm:mt-8 sm:text-lg sm:leading-8">
            {site.heroSummary}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 sm:mt-12 sm:gap-4">
            <button
              type="button"
              onClick={onOpenCommandMenu}
              className="inline-flex max-w-full items-center gap-3 border border-emerald-300/50 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100 transition hover:border-emerald-200 hover:bg-emerald-300/10"
            >
              <TerminalSquare className="size-4" aria-hidden="true" />
              Press <kbd className="border border-emerald-300/40 px-2 py-1 text-xs">?</kbd> for commands
            </button>
            <a href="#terminal" className="inline-flex items-center gap-2 px-1 py-3 text-sm text-slate-400 transition hover:text-white">
              focus terminal
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="relative"
        >
          <div className="absolute -inset-4 bg-gradient-to-br from-cyan-300/10 via-transparent to-violet-400/10 blur-2xl" aria-hidden="true" />
          <TerminalPanel commandRequest={commandRequest} />
        </motion.div>
      </div>
    </section>
  );
}
