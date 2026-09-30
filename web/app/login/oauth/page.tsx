"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { exchangeOAuthCode } from "@/lib/api";

function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const exchangePromise = useRef<ReturnType<typeof exchangeOAuthCode> | null>(
    null,
  );

  useEffect(() => {
    if (!code) return;

    // React Strict Mode intentionally re-runs effects in local development.
    // The OAuth handoff code is single-use, so both runs must await the same
    // exchange instead of issuing two requests.
    exchangePromise.current ??= exchangeOAuthCode(code);

    let active = true;
    void exchangePromise.current
      .then(() => {
        if (active) {
          router.replace("/");
          router.refresh();
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setExchangeError(
            error instanceof Error
              ? error.message
              : "Google sign-in could not be completed. Please try again.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [code, router]);

  const error = !code
    ? "Missing Google sign-in code."
    : exchangeError;

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
        <div className="max-w-sm rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm dark:border-rose-900 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Sign-in unsuccessful
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="mt-5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f5f7f5] px-5 py-10 dark:bg-[#071815]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(15,76,69,0.12)_1px,transparent_1px)] [background-size:20px_20px] dark:opacity-20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-700/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full border-[36px] border-emerald-200/35 dark:border-emerald-500/10"
      />

      <section
        className="relative w-full max-w-sm rounded-[1.75rem] border border-white/80 bg-white/95 p-8 text-center shadow-[0_24px_60px_-32px_rgba(15,61,56,0.45)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/95 sm:p-10"
        role="status"
        aria-live="polite"
        aria-label="Completing Google sign-in"
      >
        <div className="mx-auto flex w-fit items-center gap-2.5 text-left">
          <Image
            src="/doinik-hisab-logo.png"
            alt="Doinik Hisab"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl bg-white object-contain p-1 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-700"
            priority
          />
          <div>
            <p className="text-sm font-semibold tracking-tight text-brand dark:text-white">
              Doinik Hisab
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Personal finance, simplified
            </p>
          </div>
        </div>

        <div className="relative mx-auto mt-10 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-100/80 dark:bg-emerald-950/60" />
          <div className="absolute inset-1 animate-spin rounded-full border-[3px] border-emerald-600 border-t-transparent dark:border-emerald-400" />
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="relative h-7 w-7 text-emerald-700 dark:text-emerald-300"
            fill="none"
          >
            <path
              d="M12 3a9 9 0 1 0 9 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M12 7v5l3 2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="mt-7 text-base font-semibold tracking-tight text-zinc-900 dark:text-white">
          Completing your sign-in
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          Securely connecting your Google account. This will only take a moment.
        </p>

        <div className="mt-7 flex items-center justify-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Please keep this window open
        </div>
        <span className="sr-only">Completing Google sign-in</span>
      </section>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackInner />
    </Suspense>
  );
}
