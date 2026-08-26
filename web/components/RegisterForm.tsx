"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { registerUser } from "@/lib/api";
import { EyeIcon, EyeOffIcon, SpinnerIcon } from "./icons";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

function getPasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!password) return { score: 0, label: "" };

  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = ["", "Weak", "Fair", "Good", "Strong"] as const;
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const strengthBarClass: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-zinc-200 dark:bg-zinc-700",
  1: "bg-rose-500",
  2: "bg-amber-500",
  3: "bg-emerald-400",
  4: "bg-emerald-600",
};

export default function RegisterForm() {
  const router = useRouter();
  const formId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const strength = getPasswordStrength(password);
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) errors.name = "Enter your name.";
    else if (trimmedName.length < 2) errors.name = "Name is too short.";

    if (!trimmedEmail) errors.email = "Enter your email.";
    else if (!validateEmail(trimmedEmail)) {
      errors.email = "Enter a valid email address.";
    }

    if (!password) errors.password = "Choose a password.";
    else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    } else if (password.length > MAX_PASSWORD_LENGTH) {
      errors.password = `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
    }

    if (!confirmPassword) errors.confirmPassword = "Confirm your password.";
    else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

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
      await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      router.replace("/");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      // Surface duplicate-email conflicts next to the email field when possible.
      if (/already in use|already exists|conflict/i.test(message)) {
        setFieldErrors((prev) => ({
          ...prev,
          email: "An account with this email already exists.",
        }));
        setFormError(null);
      } else {
        setFormError(message);
      }
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
    <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.25)] sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Create your account
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Free to start. No credit card required.
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor={`${formId}-name`}
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Full name
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            autoComplete="name"
            autoFocus
            maxLength={100}
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) {
                setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={
              fieldErrors.name ? `${formId}-name-error` : undefined
            }
            className={fieldClass(Boolean(fieldErrors.name))}
            required
          />
          {fieldErrors.name && (
            <p
              id={`${formId}-name-error`}
              className="mt-1.5 text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={`${formId}-email`}
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            id={`${formId}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
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
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Password
          </label>
          <div className="relative">
            <input
              id={`${formId}-password`}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={`${formId}-password-hint${
                fieldErrors.password ? ` ${formId}-password-error` : ""
              }`}
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

          {password.length > 0 && (
            <div className="mt-2.5" aria-live="polite">
              <div className="flex gap-1.5">
                {([1, 2, 3, 4] as const).map((step) => (
                  <div
                    key={step}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      strength.score >= step
                        ? strengthBarClass[strength.score]
                        : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
              <p
                id={`${formId}-password-hint`}
                className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400"
              >
                Strength:{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {strength.label}
                </span>
              </p>
            </div>
          )}

          {fieldErrors.password && (
            <p
              id={`${formId}-password-error`}
              className="mt-1.5 text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={`${formId}-confirm`}
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Confirm password
          </label>
          <div className="relative">
            <input
              id={`${formId}-confirm`}
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    confirmPassword: undefined,
                  }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={
                fieldErrors.confirmPassword
                  ? `${formId}-confirm-error`
                  : passwordsMatch
                    ? `${formId}-confirm-ok`
                    : undefined
              }
              className={`${fieldClass(Boolean(fieldErrors.confirmPassword))} pr-12`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label={
                showConfirm ? "Hide confirm password" : "Show confirm password"
              }
            >
              {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {passwordsMatch && !fieldErrors.confirmPassword && (
            <p
              id={`${formId}-confirm-ok`}
              className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
            >
              Passwords match
            </p>
          )}
          {fieldErrors.confirmPassword && (
            <p
              id={`${formId}-confirm-error`}
              className="mt-1.5 text-xs text-rose-600 dark:text-rose-400"
            >
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <SpinnerIcon className="animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-emerald-600 underline-offset-2 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
