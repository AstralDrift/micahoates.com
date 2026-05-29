"use client";

import { useEffect } from "react";

import { LogoMark } from "@/components/logo-mark";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-rail grid min-h-screen place-items-center py-24">
      <section className="panel-border corner-frame max-w-2xl p-8 text-center">
        <LogoMark className="mx-auto" />
        <p className="mt-8 text-sm text-emerald-300">{"// error boundary"}</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">Something slipped out of bounds.</h1>
        <p className="mt-5 text-slate-400">The page hit a recoverable render error. Try reloading this route.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex border border-emerald-300/45 px-4 py-3 text-sm text-emerald-100 transition hover:border-emerald-200 hover:bg-emerald-300/10"
        >
          Retry
        </button>
      </section>
    </main>
  );
}
