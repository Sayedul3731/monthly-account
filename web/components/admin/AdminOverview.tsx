"use client";

import { useEffect, useState } from "react";
import {
  fetchCategories,
  fetchMemberships,
  fetchRoles,
  fetchTransactionTypes,
  fetchUsers,
} from "@/lib/api";
import type { AdminTab } from "./types";

type Counts = {
  users: number;
  roles: number;
  memberships: number;
  categories: number;
  types: number;
};

const CARDS: {
  key: keyof Counts;
  tab: Exclude<AdminTab, "overview">;
  label: string;
  hint: string;
}[] = [
  { key: "users", tab: "users", label: "Users", hint: "Accounts and access" },
  { key: "roles", tab: "roles", label: "Roles", hint: "Admin and member roles" },
  {
    key: "memberships",
    tab: "memberships",
    label: "Memberships",
    hint: "Free and paid plans",
  },
  {
    key: "categories",
    tab: "categories",
    label: "Categories",
    hint: "Income and expense groups",
  },
  {
    key: "types",
    tab: "types",
    label: "Transaction types",
    hint: "Income, expense, and more",
  },
];

type Props = {
  onOpen: (tab: Exclude<AdminTab, "overview">) => void;
  onError: (message: string) => void;
};

export default function AdminOverview({ onOpen, onError }: Props) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [users, roles, memberships, categories, types] =
          await Promise.all([
            fetchUsers(),
            fetchRoles(),
            fetchMemberships(),
            fetchCategories(),
            fetchTransactionTypes(),
          ]);
        if (cancelled) return;
        setCounts({
          users: users.length,
          roles: roles.length,
          memberships: memberships.length,
          categories: categories.length,
          types: types.length,
        });
      } catch (err) {
        if (cancelled) return;
        onError(
          err instanceof Error ? err.message : "Failed to load admin overview",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onError]);

  if (loading && !counts) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-medium text-emerald-100">Admin panel</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Manage the app
        </h2>
        <p className="mt-1 max-w-xl text-sm text-emerald-50/90">
          Create users, assign roles and memberships, and keep categories and
          transaction types in sync for everyone.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => onOpen(card.tab)}
            className="rounded-2xl border border-zinc-200/80 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
          >
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {card.label}
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              {counts?.[card.key] ?? "—"}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {card.hint}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
