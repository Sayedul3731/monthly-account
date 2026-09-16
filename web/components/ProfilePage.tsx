"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import {
  fetchMe,
  logoutUser,
  requestEmailChange,
  updateProfile,
} from "@/lib/api";
import {
  clearAuthSession,
  getAccessToken,
  isAdmin,
  type AuthUser,
} from "@/lib/auth";
import AppHeader from "./AppHeader";
import { ChevronLeft, EyeIcon, EyeOffIcon, SpinnerIcon } from "./icons";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

type ProfileErrors = {
  name?: string;
  email?: string;
  currentPassword?: string;
};

type PasswordErrors = {
  currentPassword?: string;
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
  const cadence =
    billingInterval === "quarterly"
      ? "quarterly"
      : billingInterval === "yearly"
        ? "yearly"
        : "monthly";
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState("");
  const [showPasswordCurrentPassword, setShowPasswordCurrentPassword] =
    useState(false);
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

    if (
      trimmedEmail.toLowerCase() !== user?.email &&
      !currentPassword
    ) {
      errors.currentPassword = "Enter your current password to change email.";
    }

    return errors;
  }

  function validatePassword(): PasswordErrors {
    const errors: PasswordErrors = {};

    if (!passwordCurrentPassword) {
      errors.currentPassword = "Enter your current password.";
    }

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
      let updated = user;
      if (nameChanged) {
        updated = await updateProfile({ name: trimmedName });
        setUser(updated);
        setName(updated.name);
      }

      if (emailChanged) {
        await requestEmailChange({
          email: trimmedEmail,
          currentPassword,
        });
        setCurrentPassword("");
        setEmail(updated.email);
      }

      setProfileSuccess(
        emailChanged
          ? "We sent a verification link to your new email address. Your email will change after you confirm it."
          : "Profile updated successfully.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile";
      if (/already in use|already exists|conflict/i.test(message)) {
        setProfileErrors((prev) => ({
          ...prev,
          email: "An account with this email already exists.",
        }));
      } else if (/current password/i.test(message)) {
        setProfileErrors((prev) => ({
          ...prev,
          currentPassword: "Your current password is incorrect.",
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
      await updateProfile({ password, currentPassword: passwordCurrentPassword });
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
    "border-zinc-200 focus:border-brand focus:ring-brand/15 dark:border-zinc-700";
  const inputErr =
    "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500/60";

  function fieldClass(hasError: boolean) {
    return `${inputBase} ${hasError ? inputErr : inputOk}`;
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
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

  const emailChanged = email.trim().toLowerCase() !== user.email;

  return (
    <div className="relative min-h-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(18,56,71,0.14),transparent)] dark:bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(18,56,71,0.2),transparent)]"
      />

      <div className="relative">
        <AppHeader
          signedIn
          user={{ name: user.name, email: user.email }}
          isAdmin={isAdmin(user)}
          signingOut={signingOut}
          onSignOut={handleSignOut}
        />

        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
              Account
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-white">
              Account settings
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Manage your identity, plan, and security.
            </p>
          </div>
          <Link
            href="/"
            className="mb-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-brand transition hover:bg-brand/5 hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 dark:text-gold dark:hover:bg-zinc-800"
          >
            <ChevronLeft />
            Account
          </Link>
        </div>

        <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-deep p-6 text-white shadow-xl shadow-brand/20 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border border-gold/25 bg-gold/5" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-36 w-36 rounded-full bg-white/5 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-xl font-semibold tracking-wide text-gold ring-1 ring-gold/40 backdrop-blur-sm"
              aria-hidden
            >
              {initialsFromName(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold tracking-tight">
                {user.name}
              </h2>
              <p className="mt-0.5 truncate text-sm text-white/75">
                {user.email}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-2.5 py-1 font-medium ring-1 ring-white/20">
                  {roleLabel(user.role)}
                </span>
                <Link
                  href="/membership"
                  className="rounded-full bg-gold/15 px-2.5 py-1 font-medium text-gold ring-1 ring-gold/30 transition hover:bg-gold/25"
                >
                  {membershipLabel(user.membership, user.billingInterval)} plan
                </Link>
                <span className="text-white/65">
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
            <div className="grid gap-4 sm:grid-cols-2">
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
                  if (profileErrors.currentPassword) {
                    setProfileErrors((prev) => ({
                      ...prev,
                      currentPassword: undefined,
                    }));
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
            {emailChanged && (
              <div className="sm:col-span-2 rounded-xl border border-gold/30 bg-gold/5 p-4 dark:border-gold/20 dark:bg-gold/10">
                <label
                  htmlFor={`${formId}-current-password`}
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
                >
                  Confirm your current password
                </label>
                <p className="mb-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  We will send a verification link to the new email address
                  before updating your account.
                </p>
                <div className="relative">
                  <input
                    id={`${formId}-current-password`}
                    type={showCurrentPassword ? "text" : "password"}
                    autoComplete="current-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    maxLength={MAX_PASSWORD_LENGTH}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (profileErrors.currentPassword) {
                        setProfileErrors((prev) => ({
                          ...prev,
                          currentPassword: undefined,
                        }));
                      }
                    }}
                    aria-invalid={Boolean(profileErrors.currentPassword)}
                    className={`${fieldClass(Boolean(profileErrors.currentPassword))} pr-12`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/80 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                    aria-label={
                      showCurrentPassword
                        ? "Hide current password"
                        : "Show current password"
                    }
                  >
                    {showCurrentPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {profileErrors.currentPassword && (
                  <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                    {profileErrors.currentPassword}
                  </p>
                )}
              </div>
            )}
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
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
                htmlFor={`${formId}-password-current`}
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Current password
              </label>
              <div className="relative">
                <input
                  id={`${formId}-password-current`}
                  type={showPasswordCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  maxLength={MAX_PASSWORD_LENGTH}
                  placeholder="Enter your current password"
                  value={passwordCurrentPassword}
                  onChange={(e) => {
                    setPasswordCurrentPassword(e.target.value);
                    if (passwordErrors.currentPassword) {
                      setPasswordErrors((prev) => ({
                        ...prev,
                        currentPassword: undefined,
                      }));
                    }
                  }}
                  aria-invalid={Boolean(passwordErrors.currentPassword)}
                  className={`${fieldClass(Boolean(passwordErrors.currentPassword))} pr-12`}
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswordCurrentPassword((value) => !value)
                  }
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  aria-label={
                    showPasswordCurrentPassword
                      ? "Hide current password"
                      : "Show current password"
                  }
                >
                  {showPasswordCurrentPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {passwordErrors.currentPassword && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {passwordErrors.currentPassword}
                </p>
              )}
            </div>

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
                Paid plans offer flexible monthly, quarterly, and yearly billing.
              </p>
            </div>
            <Link
              href="/membership"
              className="rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-brand/20 transition hover:bg-brand-deep"
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
                className="rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-brand/20 transition hover:bg-brand-deep"
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
                Sign out of Daily Hisab on this device.
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
    </div>
  );
}
