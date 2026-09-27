import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "You are offline | Daily Hisab",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-6 text-center dark:bg-zinc-950">
      <section className="max-w-sm rounded-2xl border border-brand/10 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gold">
          Daily Hisab
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-brand dark:text-white">
          You&apos;re offline
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Reconnect to the internet to load your latest account information.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
