"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { googleOAuthUrl, registerUser } from "@/lib/api";
import { EyeIcon, EyeOffIcon, SpinnerIcon } from "./icons";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

type FieldErrors = { name?: string; email?: string; password?: string };

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

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M21.35 12.27c0-.75-.07-1.47-.19-2.16H12v4.09h5.24a4.48 4.48 0 0 1-1.94 2.94v2.65h3.14c1.84-1.7 2.91-4.2 2.91-7.52Z" />
      <path fill="#34A853" d="M12 21.75c2.62 0 4.82-.87 6.43-2.36l-3.14-2.65c-.87.58-1.99.93-3.29.93-2.53 0-4.68-1.71-5.45-4.01H3.31v2.73A9.7 9.7 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.55 13.66A5.83 5.83 0 0 1 6.24 12c0-.58.1-1.14.31-1.66V7.61H3.31A9.72 9.72 0 0 0 2.25 12c0 1.57.38 3.06 1.06 4.39l3.24-2.73Z" />
      <path fill="#EA4335" d="M12 6.33c1.42 0 2.7.49 3.71 1.45l2.78-2.78C16.81 3.43 14.62 2.25 12 2.25a9.7 9.7 0 0 0-8.69 5.36l3.24 2.73c.77-2.3 2.92-4.01 5.45-4.01Z" />
    </svg>
  );
}

export default function RegisterForm() {
  const router = useRouter();
  const formId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const strength = getPasswordStrength(password);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) errors.name = "Enter your name.";
    else if (trimmedName.length < 2) errors.name = "Name is too short.";
    if (!trimmedEmail) errors.email = "Enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Choose a password.";
    else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    else if (password.length > MAX_PASSWORD_LENGTH) errors.password = `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
    return errors;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    try {
      await registerUser({ name: name.trim(), email: email.trim().toLowerCase(), password });
      router.replace("/");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      if (/already in use|already exists|conflict/i.test(message)) {
        setFieldErrors((current) => ({ ...current, email: "An account with this email already exists." }));
      } else {
        setFormError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputBase = "min-h-12 w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:ring-2 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500";
  const inputClass = (hasError: boolean) => `${inputBase} ${hasError ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500/60" : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700"}`;
  const labelClass = "mb-1.5 block text-[13px] font-medium text-zinc-700 sm:text-sm dark:text-zinc-300";

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_12px_30px_-18px_rgba(15,61,56,0.28)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-8 sm:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-5 sm:mb-6">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl dark:text-white">Create your Daily Hisab</h2>
        <p className="mt-1 text-[13px] text-zinc-500 sm:text-sm dark:text-zinc-400">Free to start. No credit card required.</p>
      </div>

      {formError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">{formError}</div>}

      <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4" noValidate>
        <div>
          <label htmlFor={`${formId}-name`} className={labelClass}>Full name</label>
          <input id={`${formId}-name`} type="text" autoComplete="name" maxLength={100} placeholder="Jane Doe" value={name} onChange={(event) => { setName(event.target.value); if (fieldErrors.name) setFieldErrors((current) => ({ ...current, name: undefined })); }} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? `${formId}-name-error` : undefined} className={inputClass(Boolean(fieldErrors.name))} required />
          {fieldErrors.name && <p id={`${formId}-name-error`} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.name}</p>}
        </div>

        <div>
          <label htmlFor={`${formId}-email`} className={labelClass}>Email</label>
          <input id={`${formId}-email`} type="email" autoComplete="email" inputMode="email" maxLength={255} placeholder="jane@example.com" value={email} onChange={(event) => { setEmail(event.target.value); if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined })); }} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? `${formId}-email-error` : undefined} className={inputClass(Boolean(fieldErrors.email))} required />
          {fieldErrors.email && <p id={`${formId}-email-error`} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor={`${formId}-password`} className={labelClass}>Password</label>
          <div className="relative">
            <input id={`${formId}-password`} type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} value={password} onChange={(event) => { setPassword(event.target.value); if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined })); }} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? `${formId}-password-error` : undefined} className={`${inputClass(Boolean(fieldErrors.password))} pr-12`} required />
            <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
          </div>
          {password.length > 0 && <div className="mt-2" aria-live="polite"><div className="flex gap-1.5">{([1, 2, 3, 4] as const).map((step) => <span key={step} className={`h-1 flex-1 rounded-full ${strength.score >= step ? ["", "bg-rose-500", "bg-amber-500", "bg-emerald-400", "bg-emerald-600"][strength.score] : "bg-zinc-200 dark:bg-zinc-700"}`} />)}</div><p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Password strength: <span className="font-medium text-zinc-700 dark:text-zinc-300">{strength.label}</span></p></div>}
          {fieldErrors.password && <p id={`${formId}-password-error`} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.password}</p>}
        </div>

        <button type="submit" disabled={submitting} className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? <><SpinnerIcon className="animate-spin" />Creating account…</> : "Create account"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 sm:my-6" aria-hidden="true"><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" /><span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">OR</span><div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" /></div>

      <button type="button" onClick={() => window.location.assign(googleOAuthUrl())} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"><GoogleIcon />Sign up with Google</button>

      <p className="mt-5 text-center text-sm text-zinc-500 sm:mt-6 dark:text-zinc-400">Already have an account?{" "}<Link href="/login" className="font-medium text-emerald-600 underline-offset-2 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300">Sign in</Link></p>
    </div>
  );
}
