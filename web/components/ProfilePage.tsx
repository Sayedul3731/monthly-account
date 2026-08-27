"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { fetchMe, logoutUser, updateProfile } from "@/lib/api";
import {
  clearAuthSession,
  getAccessToken,
  isAdmin,
  type AuthUser,
} from "@/lib/auth";
import { ChevronLeft, EyeIcon, EyeOffIcon, SpinnerIcon } from "./icons";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

type ProfileErrors = {
  name?: string;
  email?: string;
};

type PasswordErrors = {
  password?: string;
  confirmPassword?: string;
};

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatMemberSince(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function roleLabel(role?: AuthUser["role"]): string {
  if (!role?.name) return "Member";
  return role.name.charAt(0).toUpperCase() + role.name.slice(1);
}

function membershipLabel(
  membership?: AuthUser["membership"],
  billingInterval?: AuthUser["billingInterval"],
): string {
  if (!membership?.name) return "Free";
  if (membership.type !== "paid") return membership.name;
  const cadence = billingInterval === "yearly" ? "yearly" : "monthly";
  return `${membership.name} (${cadence})`;
}

export default function ProfilePage() {
  const router = useRouter();
  const formId = useId();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setUser(me);
        setName(me.name);
        setEmail(me.email);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load profile";
        if (/unauthorized|401|token/i.test(message)) {
          clearAuthSession();
          router.replace("/login");
          return;
        }
        setLoadError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function validateProfile(): ProfileErrors {
    const errors: ProfileErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) errors.name = "Enter your name.";
    else if (trimmedName.length < 2) errors.name = "Name is too short.";

    if (!trimmedEmail) errors.email = "Enter your email.";
    else if (!validateEmail(trimmedEmail)) {
      errors.email = "Enter a valid email address.";
    }

    return errors;
  }

  function validatePassword(): PasswordErrors {
    const errors: PasswordErrors = {};

    if (!password) errors.password = "Choose a new password.";
    else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    } else if (password.length > MAX_PASSWORD_LENGTH) {
      errors.password = `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
    }

    if (!confirmPassword) errors.confirmPassword = "Confirm your new password.";
    else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    return errors;
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const errors = validateProfile();
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const nameChanged = trimmedName !== user?.name;
    const emailChanged = trimmedEmail !== user?.email;

    if (!nameChanged && !emailChanged) {
      setProfileSuccess("Your profile is already up to date.");
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await updateProfile({
        ...(nameChanged ? { name: trimmedName } : {}),
        ...(emailChanged ? { email: trimmedEmail } : {}),
      });
      setUser(updated);
      setName(updated.name);
      setEmail(updated.email);
      setProfileSuccess("Profile updated successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile";
      if (/already in use|already exists|conflict/i.test(message)) {
        setProfileErrors((prev) => ({
          ...prev,
          email: "An account with this email already exists.",
        }));
      } else {
        setProfileError(message);
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    const errors = validatePassword();
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPassword(true);
    try {
      await updateProfile({ password });
      clearAuthSession();
      router.replace("/login?passwordChanged=1");
      router.refresh();
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logoutUser();
      router.push("/login");
    } finally {
      setSigningOut(false);
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (loadError || !user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {loadError ?? "Unable to load your profile."}
        </div>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          <ChevronLeft />
          Back to account
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.1),transparent)]"
      />

      <div className="relative mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="shrink-0">
              <Image
                src="/logo.png"
                alt="My Account logo"
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl object-contain"
                priority
              />
            </Link>
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Account settings
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Your profile
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAdmin(user) && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              >
                Admin
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <ChevronLeft />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </div>
        </header>

        <section className="mb-6 overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-semibold tracking-wide ring-1 ring-white/25 backdrop-blur-sm"
              aria-hidden
            >
              {initialsFromName(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold tracking-tight">
                {user.name}
              </h2>
              <p className="mt-0.5 truncate text-sm text-emerald-50/90">
                {user.email}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium ring-1 ring-white/20">
                  {roleLabel(user.role)}
                </span>
                <Link
                  href="/membership"
                  className="rounded-full bg-white/15 px-2.5 py-1 font-medium ring-1 ring-white/20 transition hover:bg-white/25"
                >
                  {membershipLabel(user.membership, user.billingInterval)} plan
                </Link>
                <span className="text-emerald-50/80">
                  Member since {formatMemberSince(user.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.25)] sm:p-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              Personal details
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Update how your name and email appear on your account.
            </p>
          </div>

          {profileError && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
            >
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              {profileSuccess}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4" noValidate>
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
                maxLength={100}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setProfileSuccess(null);
                  if (profileErrors.name) {
                    setProfileErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                aria-invalid={Boolean(profileErrors.name)}
                className={fieldClass(Boolean(profileErrors.name))}
                required
              />
              {profileErrors.name && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {profileErrors.name}
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
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setProfileSuccess(null);
                  if (profileErrors.email) {
                    setProfileErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                aria-invalid={Boolean(profileErrors.email)}
                className={fieldClass(Boolean(profileErrors.email))}
                required
              />
              {profileErrors.email && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {profileErrors.email}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {savingProfile ? (
                <>
                  <SpinnerIcon className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </form>
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.25)] sm:p-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              Password
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Choose a new password. You will be signed out afterward for
              security.
            </p>
          </div>

          {passwordError && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
            >
              {passwordError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor={`${formId}-password`}
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                New password
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
                    if (passwordErrors.password) {
                      setPasswordErrors((prev) => ({
                        ...prev,
                        password: undefined,
                      }));
                    }
                  }}
                  aria-invalid={Boolean(passwordErrors.password)}
                  className={`${fieldClass(Boolean(passwordErrors.password))} pr-12`}
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
              {passwordErrors.password && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {passwordErrors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={`${formId}-confirm`}
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id={`${formId}-confirm`}
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  maxLength={MAX_PASSWORD_LENGTH}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordErrors.confirmPassword) {
                      setPasswordErrors((prev) => ({
                        ...prev,
                        confirmPassword: undefined,
                      }));
                    }
                  }}
                  aria-invalid={Boolean(passwordErrors.confirmPassword)}
                  className={`${fieldClass(Boolean(passwordErrors.confirmPassword))} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  aria-label={
                    showConfirm
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {passwordErrors.confirmPassword && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {passwordErrors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 sm:w-auto sm:px-6"
            >
              {savingPassword ? (
                <>
                  <SpinnerIcon className="animate-spin" />
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.25)] sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                Membership
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                You are on the {membershipLabel(user.membership, user.billingInterval)} plan.
                Paid is $1 / month or $6 / year.
              </p>
            </div>
            <Link
              href="/membership"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              View plans
            </Link>
          </div>
        </section>

        {isAdmin(user) && (
          <section className="mb-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.25)] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                  Admin
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Manage users, roles, memberships, categories, and transaction
                  types.
                </p>
              </div>
              <Link
                href="/admin"
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Open admin panel
              </Link>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 dark:border-zinc-800 dark:bg-zinc-900/90 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                Session
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Sign out of My Monthly Account on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
