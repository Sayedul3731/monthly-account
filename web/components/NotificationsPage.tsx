"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  fetchNotifications,
  logoutUser,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api";
import {
  clearAuthSession,
  getAccessToken,
  isAdmin,
  type AuthUser,
} from "@/lib/auth";
import AppHeader from "./AppHeader";
import { SpinnerIcon } from "./icons";

function notificationDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [me, items] = await Promise.all([fetchMe(), fetchNotifications()]);
        if (cancelled) return;
        setUser(me);
        setNotifications(items);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load notifications";
        if (/unauthorized|401|token/i.test(message)) {
          clearAuthSession();
          router.replace("/login");
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

  async function handleOpen(notification: AppNotification) {
    try {
      if (!notification.readAt) {
        const updated = await markNotificationRead(notification.id);
        setNotifications((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        window.dispatchEvent(new Event("notifications:updated"));
      }
      router.push(notification.link || "/membership");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open notification");
    }
  }

  async function handleMarkAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      window.dispatchEvent(new Event("notifications:updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update notifications");
    } finally {
      setMarkingAll(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><SpinnerIcon className="animate-spin" /></div>;
  }

  if (error && !user) {
    return <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6"><div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">{error}</div></main>;
  }

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <div className="relative min-h-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="relative">
        <AppHeader signedIn user={{ name: user?.name ?? "", email: user?.email }} isAdmin={isAdmin(user)} signingOut={signingOut} onSignOut={handleSignOut} />
        <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-white">Notifications</h1>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Payment verification updates and account activity.</p>
            </div>
            {unreadCount > 0 && <button type="button" onClick={handleMarkAllRead} disabled={markingAll} className="inline-flex w-fit rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">{markingAll ? "Updating…" : "Mark all as read"}</button>}
          </div>

          {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">{error}</div>}

          <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {notifications.length === 0 ? (
              <div className="px-6 py-12 text-center"><p className="font-medium text-zinc-900 dark:text-white">You are all caught up.</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Payment verification updates will appear here.</p><Link href="/membership" className="mt-4 inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">View membership</Link></div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {notifications.map((notification) => (
                  <button key={notification.id} type="button" onClick={() => void handleOpen(notification)} className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${notification.readAt ? "" : "bg-emerald-50/60 dark:bg-emerald-950/15"}`}>
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? "bg-zinc-300 dark:bg-zinc-700" : notification.type === "payment_rejected" ? "bg-rose-500" : notification.type === "payment_submitted" ? "bg-amber-500" : notification.type === "membership_cancelled" ? "bg-zinc-400" : "bg-emerald-500"}`} aria-hidden />
                    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-zinc-900 dark:text-white">{notification.title}</span><span className="text-xs text-zinc-500 dark:text-zinc-400">{notificationDate(notification.createdAt)}</span></span><span className="mt-1 block text-sm leading-6 text-zinc-600 dark:text-zinc-300">{notification.message}</span></span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
