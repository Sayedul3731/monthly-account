"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "./icons";

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

function navClass(active: boolean) {
  return `rounded-md px-2.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${
    active
      ? "bg-brand/10 text-brand dark:bg-zinc-800 dark:text-white"
      : "text-zinc-500 hover:bg-brand/5 hover:text-brand dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
  }`;
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
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const accountActive = pathname === "/";
  const adminActive = pathname.startsWith("/admin");
  const profileActive = pathname.startsWith("/profile");

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

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
            <nav aria-label="Primary" className="hidden items-center sm:flex">
              <Link href="/" className={navClass(accountActive)}>
                Account
              </Link>
            </nav>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
                aria-label="Account menu"
                onClick={() => setMenuOpen((open) => !open)}
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
                      href="/"
                      role="menuitem"
                      className={`${menuItemClass(accountActive)} sm:hidden`}
                      onClick={() => setMenuOpen(false)}
                    >
                      Account
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
