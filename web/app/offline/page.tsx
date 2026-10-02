import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "You are offline | Protidiner Hisab",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#f5f7f5] px-5 py-10 text-center dark:bg-[#071815]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(15,76,69,0.12)_1px,transparent_1px)] [background-size:20px_20px] dark:opacity-20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-700/15"
      />

      <section className="relative w-full max-w-sm rounded-[1.75rem] border border-white/80 bg-white/95 p-8 shadow-[0_24px_60px_-32px_rgba(15,61,56,0.45)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/95 sm:p-10">
        <div className="mx-auto flex w-fit items-center gap-2.5 text-left">
          <Image
            src="/doinik-hisab-logo.png"
            alt="Protidiner Hisab"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl bg-white object-contain p-1 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-700"
            priority
          />
          <div>
            <p className="text-sm font-semibold tracking-tight text-brand dark:text-white">
              Protidiner Hisab
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Personal finance, simplified
            </p>
          </div>
        </div>

        <div className="mx-auto mt-9 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/70">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none">
            <path d="M2 8.82a15.91 15.91 0 0 1 20 0M5 12.85a10.94 10.94 0 0 1 14 0M8.7 16.55a5.89 5.89 0 0 1 6.6 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <p className="mt-7 text-xs font-semibold tracking-[0.16em] text-amber-700 uppercase dark:text-amber-300">
          Connection unavailable
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand dark:text-white">
          You&apos;re offline
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Check your internet connection, then try again. Your latest account updates will be available once you reconnect.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Retry connection
        </Link>
      </section>
    </main>
  );
}
