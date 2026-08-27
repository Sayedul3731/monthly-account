"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchBudgets,
  fetchTransactions,
  logoutUser,
  type Budget,
} from "@/lib/api";
import { getAccessToken, getStoredUser } from "@/lib/auth";
import {
  formatCurrency,
  formatMonthLabel,
  summarize,
  type Transaction,
} from "@/lib/finance";
import BudgetPanel from "./BudgetPanel";
import CategoryChart from "./CategoryChart";
import ExportImportPanel from "./ExportImportPanel";
import { ChevronLeft, ChevronRight } from "./icons";
import TransactionForm from "./TransactionForm";
import TransactionList from "./TransactionList";

const today = new Date();

type Tab = "overview" | "transactions" | "budgets" | "data";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "budgets", label: "Budgets" },
  { id: "data", label: "Export / Import" },
];

export default function MonthlyAccount() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const user = getStoredUser();
    setSignedIn(Boolean(token));
    setUserName(user?.name ?? null);
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logoutUser();
      setSignedIn(false);
      setUserName(null);
      setTransactions([]);
      setBudgets([]);
      router.push("/login");
    } finally {
      setSigningOut(false);
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [txData, budgetData] = await Promise.all([
        fetchTransactions(year, month),
        fetchBudgets(year, month),
      ]);
      setTransactions(txData);
      setBudgets(budgetData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load data",
      );
      setTransactions([]);
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => summarize(transactions), [transactions]);

  const expenseShare =
    stats.income > 0 ? Math.min((stats.expenses / stats.income) * 100, 100) : 0;

  function changeMonth(delta: number) {
    setEditing(null);
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  function handleSaved(
    entry: Transaction,
    navigatedMonth?: { year: number; month: number },
  ) {
    setEditing(null);

    if (navigatedMonth) {
      setYear(navigatedMonth.year);
      setMonth(navigatedMonth.month);
      return;
    }

    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === entry.id);
      if (exists) {
        return prev.map((t) => (t.id === entry.id ? entry : t));
      }
      return [entry, ...prev];
    });
  }

  function handleEdit(transaction: Transaction) {
    setEditing(transaction);
    setTab("transactions");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="My Account logo"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl object-contain"
              priority
            />
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Monthly Tracker
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                My Account
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            {signedIn ? (
              <>
                <Link
                  href="/profile"
                  className="hidden max-w-[8rem] truncate rounded-lg px-2.5 py-1.5 font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 sm:inline dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  title="View profile"
                >
                  {userName ?? "Profile"}
                </Link>
                <Link
                  href="/membership"
                  className="hidden rounded-lg px-2.5 py-1.5 font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 sm:inline dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  Membership
                </Link>
                <Link
                  href="/profile"
                  className="rounded-lg px-3 py-1.5 font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 sm:hidden dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-lg px-3 py-1.5 font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-1.5 font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white transition hover:bg-emerald-700"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              aria-label="Previous month"
            >
              <ChevronLeft />
            </button>
            <span className="min-w-[9rem] px-2 text-center text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {formatMonthLabel(year, month)}
            </span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              aria-label="Next month"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
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
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {tab === "overview" && (
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-xl shadow-emerald-500/20">
            <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

            <p className="text-sm font-medium text-emerald-100">Net Balance</p>
            <p className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
              {formatCurrency(stats.balance)}
            </p>
            <p className="mt-2 text-sm text-emerald-100/90">
              {stats.balance >= 0
                ? "You're in the green"
                : "Spending exceeds income"}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">
                  Income
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrency(stats.income)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">
                  Expenses
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrency(stats.expenses)}
                </p>
              </div>
            </div>

            {stats.income > 0 && (
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs text-emerald-100">
                  <span>Spent of income</span>
                  <span>{expenseShare.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{ width: `${expenseShare}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-emerald-100/80">
                  Savings rate: {stats.savingsRate.toFixed(0)}%
                </p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-white">
              Category breakdown
            </h2>
            <CategoryChart transactions={transactions} />
          </section>
        </div>
      )}

      {tab === "transactions" && (
        <div className="space-y-6">
          <TransactionForm
            key={editing?.id ?? "new"}
            year={year}
            month={month}
            editing={editing}
            onSaved={handleSaved}
            onCancelEdit={() => setEditing(null)}
            onError={setError}
          />
          <TransactionList
            transactions={transactions}
            onEdit={handleEdit}
            onDeleted={(id) =>
              setTransactions((prev) => prev.filter((t) => t.id !== id))
            }
            onError={setError}
          />
        </div>
      )}

      {tab === "budgets" && (
        <BudgetPanel
          year={year}
          month={month}
          budgets={budgets}
          transactions={transactions}
          onBudgetsChange={setBudgets}
          onError={setError}
        />
      )}

      {tab === "data" && (
        <ExportImportPanel
          year={year}
          month={month}
          transactions={transactions}
          onImported={loadData}
          onError={setError}
        />
      )}
    </div>
  );
}
