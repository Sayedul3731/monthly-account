"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  fetchNotifications,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api";
import { BellIcon, ChevronDown } from "./icons";

export type AppHeaderUser = {
  name: string;
  email?: string | null;
};

type AppHeaderProps = {
  signedIn: boolean;
  user?: AppHeaderUser | null;
  isAdmin?: boolean;
  signingOut?: boolean;
  onSignOut?: () => void;
  wide?: boolean;
  ready?: boolean;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function menuItemClass(active = false) {
  return `flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition ${
    active
      ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white"
      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
  }`;
}

export default function AppHeader({
  signedIn,
  user,
  isAdmin = false,
  signingOut = false,
  onSignOut,
  wide = false,
  ready = true,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const notificationsMenuId = useId();

  const adminActive = pathname.startsWith("/admin");
  const profileActive = pathname.startsWith("/profile");
  const notificationsActive = pathname.startsWith("/notifications");

  useEffect(() => {
    if (!menuOpen && !notificationsOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, notificationsOpen]);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    async function refreshNotifications() {
      try {
        const notifications = await fetchNotifications();
        if (!cancelled) {
          setNotifications(notifications);
          setUnreadCount(
            notifications.filter((notification) => !notification.readAt).length,
          );
        }
      } catch {
        // Notifications should not prevent the rest of the header from rendering.
        if (!cancelled) setUnreadCount(0);
      }
    }

    void refreshNotifications();
    window.addEventListener("notifications:updated", refreshNotifications);
    return () => {
      cancelled = true;
      window.removeEventListener("notifications:updated", refreshNotifications);
    };
  }, [signedIn]);

  async function openNotification(notification: AppNotification) {
    setNotificationsOpen(false);
    try {
      if (!notification.readAt) {
        const updated = await markNotificationRead(notification.id);
        setNotifications((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setUnreadCount((current) => Math.max(0, current - 1));
        window.dispatchEvent(new Event("notifications:updated"));
      }
      router.push(notification.link || "/membership");
    } catch {
      // Keep the notification visible if marking it read cannot be completed.
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-brand/10 bg-paper/85 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/85">
      <div
        className={`mx-auto flex h-14 w-full items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 ${
          wide ? "max-w-5xl" : "max-w-2xl"
        }`}
      >
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        >
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-contain ring-1 ring-zinc-200/80 dark:ring-zinc-700"
            priority
          />
          <span className="truncate text-sm font-semibold tracking-tight text-brand dark:text-white">
            Daily Hisab
          </span>
        </Link>

        {!ready ? (
          <div
            className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800"
            aria-hidden
          />
        ) : signedIn ? (
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                aria-expanded={notificationsOpen}
                aria-haspopup="menu"
                aria-controls={notificationsMenuId}
                aria-label={unreadCount ? `Notifications (${unreadCount} unread)` : "Notifications"}
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setMenuOpen(false);
                }}
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 transition hover:bg-brand/5 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white ${
                  notificationsActive || notificationsOpen ? "bg-brand/10 text-brand dark:bg-zinc-800 dark:text-white" : ""
                }`}
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-1 ring-paper dark:ring-zinc-950">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div
                  id={notificationsMenuId}
                  role="menu"
                  className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:max-h-none sm:w-[22rem] sm:overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">Notifications</p>
                    {unreadCount > 0 && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{unreadCount} unread</span>}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No notifications yet.</p>
                  ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {notifications.slice(0, 4).map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          role="menuitem"
                          onClick={() => void openNotification(notification)}
                          className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800 ${notification.readAt ? "" : "bg-emerald-50/60 dark:bg-emerald-950/15"}`}
                        >
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-zinc-300 dark:bg-zinc-700" : notification.type === "payment_rejected" ? "bg-rose-500" : notification.type === "payment_submitted" ? "bg-amber-500" : notification.type === "membership_cancelled" ? "bg-zinc-400" : "bg-emerald-500"}`} aria-hidden />
                          <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-900 dark:text-white">{notification.title}</span><span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">{notification.message}</span></span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-zinc-100 p-2 dark:border-zinc-800">
                    {notifications.length > 4 && <p className="px-2 pb-2 text-xs text-zinc-500 dark:text-zinc-400">+{notifications.length - 4} more notification{notifications.length - 4 === 1 ? "" : "s"}</p>}
                    <Link href="/notifications" role="menuitem" onClick={() => setNotificationsOpen(false)} className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40">See all notifications</Link>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
                aria-label="Account menu"
                onClick={() => {
                  setMenuOpen((open) => !open);
                  setNotificationsOpen(false);
                }}
                className={`flex items-center gap-1.5 rounded-full p-1 pr-1.5 transition hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 dark:hover:bg-zinc-800 ${
                  profileActive || adminActive || menuOpen
                    ? "bg-brand/5 dark:bg-zinc-800"
                    : ""
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[11px] font-semibold tracking-wide text-white">
                  {initialsFromName(user?.name ?? "")}
                </span>
                <ChevronDown
                  className={`text-zinc-500 transition ${
                    menuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {menuOpen && (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40"
                >
                  <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                      {user?.name ?? "Account"}
                    </p>
                    {user?.email && (
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {user.email}
                      </p>
                    )}
                  </div>

                  <div className="p-1">
                    <Link
                      href="/notifications"
                      role="menuitem"
                      className={menuItemClass(notificationsActive)}
                      onClick={() => setMenuOpen(false)}
                    >
                      Notifications
                    </Link>
                    <Link
                      href="/profile"
                      role="menuitem"
                      className={menuItemClass(profileActive)}
                      onClick={() => setMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        className={menuItemClass(adminActive)}
                        onClick={() => setMenuOpen(false)}
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={onSignOut}
                      disabled={signingOut}
                      className={`${menuItemClass()} disabled:opacity-60`}
                    >
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white transition hover:bg-brand-deep"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
