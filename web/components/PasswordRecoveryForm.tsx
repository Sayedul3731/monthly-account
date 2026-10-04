"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useState, useSyncExternalStore } from "react";
import { requestPasswordReset, resetPassword } from "@/lib/api";

const subscribe = () => () => {};

function RecoveryForm({ reset }: { reset: boolean }) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const router = useRouter();
  const params = useSearchParams();
  const [token] = useState(() => params.get("token") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (reset && token) window.history.replaceState(null, "", "/reset-password");
  }, [reset, token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (reset && !/^[a-f0-9]{64}$/.test(token)) {
      setError("This reset link is invalid. Request a new link.");
      return;
    }
    if (reset && (password.length < 8 || password.length > 64 || password !== confirmation)) {
      setError("Use 8–64 characters and enter the same password twice.");
      return;
    }
    setBusy(true);
    try {
      if (reset) {
        await resetPassword(token, password);
        router.replace("/login?passwordChanged=1");
      } else {
        await requestPasswordReset(email);
        setSent(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950";
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-2xl font-semibold">{reset ? "Choose a new password" : "Forgot your password?"}</h2>
      <p className="my-4 text-sm text-zinc-500">{reset ? "Resetting your password signs out your existing sessions." : "Enter your account email. Reset links expire in 30 minutes. For Google accounts, use Google sign-in."}</p>
      {error && <p role="alert" className="mb-4 text-sm text-rose-600">{error}</p>}
      {sent ? (
        <p role="status" className="text-sm text-emerald-700">If an account with a password exists, a reset link will be emailed to you. Check your spam folder too.</p>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={!hydrated || busy} className="space-y-4">
          {reset ? <>
            <label htmlFor={`${id}-password`} className="block text-sm">New password
              <input id={`${id}-password`} type="password" autoComplete="new-password" minLength={8} maxLength={64} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </label>
            <label htmlFor={`${id}-confirm`} className="block text-sm">Confirm password
              <input id={`${id}-confirm`} type="password" autoComplete="new-password" minLength={8} maxLength={64} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputClass} />
            </label>
          </> : <label htmlFor={`${id}-email`} className="block text-sm">Email
            <input id={`${id}-email`} type="email" autoComplete="email" maxLength={255} required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>}
          <button disabled={busy || (reset && !token)} className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : reset ? "Reset password" : "Send reset link"}</button>
          </fieldset>
        </form>
      )}
      <div className="mt-5 flex flex-wrap gap-4 text-sm text-emerald-700">
        <Link href="/login">Back to sign in</Link>
        {reset && <Link href="/forgot-password">Request a new reset link</Link>}
      </div>
    </section>
  );
}

export default function PasswordRecoveryForm(props: { reset?: boolean }) {
  return <Suspense fallback={<p>Loading recovery form…</p>}><RecoveryForm reset={Boolean(props.reset)} /></Suspense>;
}
