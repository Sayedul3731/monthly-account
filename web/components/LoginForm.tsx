"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useId, useState } from "react";
import { googleOAuthUrl, loginUser } from "@/lib/api";
import { EyeIcon, EyeOffIcon, SpinnerIcon } from "./icons";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formId = useId();
  const passwordChanged = searchParams.get("passwordChanged") === "1";
  const oauthError = searchParams.get("oauthError") === "google";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) errors.email = "Enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Enter a valid email address.";
    }

    if (!password) errors.password = "Enter your password.";

    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);

    try {
      await loginUser({
        email: email.trim().toLowerCase(),
        password,
      });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  const inputBase =
    "w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:ring-2 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500";
  const inputOk =
    "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700";
  const inputErr =
    "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500/60";

  function fieldClass(hasError: boolean) {
    return `${inputBase} ${hasError ? inputErr : inputOk}`;
  }

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(15,61,56,0.35)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase dark:text-emerald-400">
          Account access
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Welcome back
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Sign in to continue managing your money with confidence.
        </p>
      </div>

      {passwordChanged && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
        >
          Password updated. Sign in with your new password.
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {formError}
        </div>
      )}

      {oauthError && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          Google sign-in could not be completed. Please try again.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label
            htmlFor={`${formId}-email`}
            className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            id={`${formId}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            maxLength={255}
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={
              fieldErrors.email ? `${formId}-email-error` : undefined
            }
            className={fieldClass(Boolean(fieldErrors.email))}
            required
          />
          {fieldErrors.email && (
            <p
              id={`${formId}-email-error`}
              className="mt-1.5 text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={`${formId}-password`}
            className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Password
          </label>
          <div className="relative">
            <input
              id={`${formId}-password`}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              maxLength={72}
              placeholder="Your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? `${formId}-password-error` : undefined
              }
              className={`${fieldClass(Boolean(fieldErrors.password))} pr-12`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {fieldErrors.password && (
            <p
              id={`${formId}-password-error`}
              className="mt-1.5 text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f4c45] py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/15 transition hover:bg-[#0b3d37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f4c45] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {submitting ? (
            <>
              <SpinnerIcon className="animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
          OR
        </span>
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <button
        type="button"
        onClick={() => window.location.assign(googleOAuthUrl())}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
          <path
            fill="#4285F4"
            d="M21.35 12.27c0-.75-.07-1.47-.19-2.16H12v4.09h5.24a4.48 4.48 0 0 1-1.94 2.94v2.65h3.14c1.84-1.7 2.91-4.2 2.91-7.52Z"
          />
          <path
            fill="#34A853"
            d="M12 21.75c2.62 0 4.82-.87 6.43-2.36l-3.14-2.65c-.87.58-1.99.93-3.29.93-2.53 0-4.68-1.71-5.45-4.01H3.31v2.73A9.7 9.7 0 0 0 12 21.75Z"
          />
          <path
            fill="#FBBC05"
            d="M6.55 13.66A5.83 5.83 0 0 1 6.24 12c0-.58.1-1.14.31-1.66V7.61H3.31A9.72 9.72 0 0 0 2.25 12c0 1.57.38 3.06 1.06 4.39l3.24-2.73Z"
          />
          <path
            fill="#EA4335"
            d="M12 6.33c1.42 0 2.7.49 3.71 1.45l2.78-2.78C16.81 3.43 14.62 2.25 12 2.25a9.7 9.7 0 0 0-8.69 5.36l3.24 2.73c.77-2.3 2.92-4.01 5.45-4.01Z"
          />
        </svg>
        Continue with Google
      </button>

      <p className="mt-7 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-emerald-600 underline-offset-2 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          Create account
        </Link>
      </p>

      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Secure sign-in for your personal records
      </p>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/90">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
