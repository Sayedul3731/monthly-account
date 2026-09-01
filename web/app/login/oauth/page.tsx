"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { exchangeOAuthCode } from "@/lib/api";

function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [exchangeFailed, setExchangeFailed] = useState(false);

  useEffect(() => {
    if (!code) return;

    let active = true;
    void exchangeOAuthCode(code)
      .then(() => {
        if (active) {
          router.replace("/");
          router.refresh();
        }
      })
      .catch(() => {
        if (active) setExchangeFailed(true);
      });

    return () => {
      active = false;
    };
  }, [code, router]);

  const error = !code
    ? "Missing Google sign-in code."
    : exchangeFailed
      ? "Google sign-in has expired. Please try again."
      : null;

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
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        Completing Google sign-in…
      </div>
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
