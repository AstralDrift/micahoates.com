import Link from "next/link";

import { LogoMark } from "@/components/logo-mark";

export default function NotFound() {
  return (
    <main className="page-rail grid min-h-screen place-items-center py-24">
      <section className="panel-border corner-frame max-w-2xl p-8 text-center">
        <LogoMark className="mx-auto" />
        <p className="mt-8 text-sm text-emerald-300">{"// 404"}</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">Route not mapped.</h1>
        <p className="mt-5 text-slate-400">This path is not part of the current system graph.</p>
        <Link
          href="/"
          className="mt-8 inline-flex border border-emerald-300/45 px-4 py-3 text-sm text-emerald-100 transition hover:border-emerald-200 hover:bg-emerald-300/10"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
