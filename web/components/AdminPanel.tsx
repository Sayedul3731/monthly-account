"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchMe, logoutUser } from "@/lib/api";
import {
  clearAuthSession,
  getAccessToken,
  isAdmin,
  type AuthUser,
} from "@/lib/auth";
import AppHeader from "./AppHeader";
import AdminOverview from "./admin/AdminOverview";
import CategoriesAdmin from "./admin/CategoriesAdmin";
import MembershipsAdmin from "./admin/MembershipsAdmin";
import RolesAdmin from "./admin/RolesAdmin";
import TransactionTypesAdmin from "./admin/TransactionTypesAdmin";
import type { AdminTab } from "./admin/types";
import UsersAdmin from "./admin/UsersAdmin";
import { ChevronLeft } from "./icons";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles" },
  { id: "memberships", label: "Memberships" },
  { id: "categories", label: "Categories" },
  { id: "types", label: "Types" },
];

export default function AdminPanel() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

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
        if (!isAdmin(me)) {
          setForbidden(true);
          setUser(me);
          return;
        }
        setUser(me);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load admin panel";
        if (/unauthorized|401|token/i.test(message)) {
          clearAuthSession();
          router.replace("/login");
          return;
        }
        if (/forbidden|403/i.test(message)) {
          setForbidden(true);
          return;
        }
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (forbidden || !user || !isAdmin(user)) {
    return (
      <div className="relative min-h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        <div className="relative mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
          <div
            role="alert"
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8"
          >
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Admin
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              You don’t have access
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              This area is limited to administrators.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              <ChevronLeft />
              Back to account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.1),transparent)]"
      />

      <div className="relative">
        <AppHeader
          signedIn
          user={{ name: user.name, email: user.email }}
          isAdmin
          signingOut={signingOut}
          onSignOut={handleSignOut}
          wide
        />

        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-white">
            Admin
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Users, roles, plans, and catalogs
          </p>
        </div>

        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setError(null);
              }}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {error && (
          <div className="mb-6">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-3 font-medium underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {tab === "overview" && (
          <AdminOverview
            onOpen={(next) => setTab(next)}
            onError={handleError}
          />
        )}
        {tab === "users" && (
          <UsersAdmin currentUserId={user.id} onError={handleError} />
        )}
        {tab === "roles" && <RolesAdmin onError={handleError} />}
        {tab === "memberships" && (
          <MembershipsAdmin onError={handleError} />
        )}
        {tab === "categories" && (
          <CategoriesAdmin onError={handleError} />
        )}
        {tab === "types" && (
          <TransactionTypesAdmin onError={handleError} />
        )}
        </div>
      </div>
    </div>
  );
}
