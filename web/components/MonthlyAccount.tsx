"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  fetchBudgets,
  fetchTransactions,
  logoutUser,
  type Budget,
} from "@/lib/api";
import { getAccessToken, getStoredUser, isAdmin } from "@/lib/auth";
import {
  formatCurrency,
  formatMonthLabel,
  summarize,
  type Transaction,
} from "@/lib/finance";
import AppHeader from "./AppHeader";
import BudgetPanel from "./BudgetPanel";
import CategoryChart from "./CategoryChart";
// import ExportImportPanel from "./ExportImportPanel";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendDownIcon,
  TrendUpIcon,
  WalletIcon,
} from "./icons";
import TransactionForm from "./TransactionForm";
import TransactionList from "./TransactionList";
import { useToast } from "@/components/ToastProvider";
import CalendarView from "./CalendarView";

const today = new Date();

type Tab = "overview" | "transactions" | "calendar" | "budgets";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "calendar", label: "Calender View" },
  { id: "budgets", label: "Budgets" },
];

export default function MonthlyAccount() {
  const router = useRouter();
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [sessionUser, setSessionUser] = useState<ReturnType<
    typeof getStoredUser
  >>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logoutUser();
      setSignedIn(false);
      setSessionUser(null);
      setTransactions([]);
      setBudgets([]);
      router.push("/login");
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSignedIn(Boolean(getAccessToken()));
      setSessionUser(getStoredUser());
      setAuthReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!authReady) return;

    if (!signedIn) {
      return;
    }

    async function loadData() {
      try {
        const [txData, budgetData] = await Promise.all([
          fetchTransactions(year, month),
          fetchBudgets(year, month),
        ]);
        if (cancelled) return;

        setTransactions(txData);
        setBudgets(budgetData);
      } catch (err) {
        if (cancelled) return;

        showToast(err instanceof Error ? err.message : "Failed to load data", {
          kind: "error",
          title: "Could not load account",
        });
        setTransactions([]);
        setBudgets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [authReady, month, showToast, signedIn, year]);

  const stats = useMemo(() => summarize(transactions), [transactions]);
  const hasIncome = stats.income > 0;
  const hasSurplus = stats.balance >= 0;

  const expenseShare =
    hasIncome ? Math.min((stats.expenses / stats.income) * 100, 100) : 0;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();
  const elapsedDays = isCurrentMonth ? today.getDate() : daysInMonth;
  const monthProgress = (elapsedDays / daysInMonth) * 100;
  const daysLeft = isCurrentMonth ? Math.max(daysInMonth - today.getDate(), 0) : 0;

  const overallBudget = budgets.find((budget) => !budget.category);
  const budgetRemaining = overallBudget
    ? overallBudget.amount - stats.expenses
    : null;

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        )
        .slice(0, 4),
    [transactions],
  );

  function changeMonth(delta: number) {
    setEditing(null);
    setLoading(true);
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  function handleSaved(
    entry: Transaction,
    navigatedMonth?: { year: number; month: number },
  ) {
    const wasEditing = Boolean(editing);
    setEditing(null);

    showToast(
      wasEditing ? "Transaction updated." : "Transaction added.",
      { kind: "success" },
    );

    if (navigatedMonth) {
      setLoading(true);
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

  const header = (
    <AppHeader
      signedIn={signedIn}
      user={
        sessionUser
          ? { name: sessionUser.name, email: sessionUser.email }
          : null
      }
      isAdmin={isAdmin(sessionUser)}
      signingOut={signingOut}
      onSignOut={handleSignOut}
      ready={authReady}
    />
  );

  if (loading && (!authReady || signedIn)) {
    return (
      <>
        {header}
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-6 sm:py-5">
      <header className="mb-3 flex flex-col gap-1.5 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold sm:tracking-[0.2em]">
            Monthly overview
          </p>
          <h1 className="mt-0.5 text-lg font-semibold leading-tight tracking-tight text-brand sm:text-xl dark:text-white">
            আমার হিসাব
          </h1>
          <p className="mt-0.5 text-[11px] leading-4 text-zinc-500 sm:text-xs dark:text-zinc-400">
            এই মাসের আয়, ব্যয় ও বাজেট
          </p>
        </div>
        {tab !== "calendar" && <div className="flex items-center gap-0.5 self-start rounded-full border border-brand/15 bg-white p-px shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:gap-1 sm:p-0.5 sm:self-auto">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="rounded-full p-1 text-brand/70 transition hover:bg-brand/5 hover:text-brand sm:p-1.5 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label="আগের মাস"
          >
            <ChevronLeft />
          </button>
          <span
            className="min-w-[7rem] px-1 text-center text-xs font-semibold text-brand sm:min-w-[8rem] sm:px-1.5 sm:text-[13px] dark:text-zinc-100"
            aria-live="polite"
          >
            {formatMonthLabel(year, month)}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="rounded-full p-1 text-brand/70 transition hover:bg-brand/5 hover:text-brand sm:p-1.5 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label="পরের মাস"
          >
            <ChevronRight />
          </button>
        </div>}
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-brand/10 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === id
                ? "bg-brand text-white shadow-sm shadow-brand/20"
                : "text-zinc-600 hover:bg-brand/5 hover:text-brand dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-3xl bg-brand bg-gradient-to-br from-brand via-brand to-brand-deep p-6 text-white shadow-xl shadow-brand/25">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold/40 via-gold to-gold/40" />
            <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-gold/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute right-6 top-8 hidden h-24 w-24 rounded-full border border-gold/20 sm:block" />

            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                  {formatMonthLabel(year, month)} overview
                </p>
                {hasIncome ? (
                  <>
                    <p className="mt-3 text-sm font-medium text-white/70">
                      {hasSurplus ? "Net balance" : "Amount to cover"}
                    </p>
                    <p className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
                      {formatCurrency(Math.abs(stats.balance))}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                      খরচের হিসাব থাকুক হাতের মুঠোয়।
                    </h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/70">
                      Record your expenses and income to maintain a clear view
                      of your monthly balance and savings progress.
                    </p>
                  </>
                )}
              </div>
              {hasIncome && (
                <span
                  className={`mt-1 shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                    hasSurplus
                      ? "border-gold/40 bg-gold/15 text-gold"
                      : "border-rose-300/40 bg-rose-400/15 text-rose-100"
                  }`}
                >
                  {hasSurplus ? "On track" : "Needs attention"}
                </span>
              )}
            </div>

            <div
              className={`relative mt-6 grid gap-3 ${
                hasIncome ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {hasIncome && (
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-white/70">
                    <TrendUpIcon className="text-gold" />
                    Income
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatCurrency(stats.income)}
                  </p>
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-white/70">
                  <TrendDownIcon className="text-rose-200" />
                  {hasIncome ? "Expenses" : "Spending tracked"}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrency(stats.expenses)}
                </p>
              </div>
            </div>

            <div className="relative mt-5">
              <div className="mb-1.5 flex justify-between text-xs text-white/70">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon />
                  {isCurrentMonth
                    ? `Day ${elapsedDays} of ${daysInMonth}`
                    : `${daysInMonth} days in month`}
                </span>
                <span>
                  {isCurrentMonth ? `${daysLeft} days left` : "Closed month"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gold transition-all duration-500"
                  style={{ width: `${monthProgress}%` }}
                />
              </div>
            </div>

            {hasIncome && (
              <div className="relative mt-4">
                <div className="mb-1.5 flex justify-between text-xs text-white/70">
                  <span>Spent of income</span>
                  <span>{expenseShare.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white/80 transition-all duration-500"
                    style={{ width: `${expenseShare}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/60">
                  Savings rate {stats.savingsRate.toFixed(0)}%
                </p>
              </div>
            )}
          </section>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-brand/10 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Saved
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-brand dark:text-white">
                {stats.income > 0 ? `${stats.savingsRate.toFixed(0)}%` : "0%"}
              </p>
            </div>
            <div className="rounded-2xl border border-brand/10 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Activity
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-brand dark:text-white">
                {transactions.length}
                <span className="ml-1 text-xs font-medium text-zinc-400">
                  tx
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-brand/10 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {budgetRemaining !== null && budgetRemaining < 0
                  ? "Over budget"
                  : "Budget left"}
              </p>
              <p
                className={`mt-1 text-base font-semibold tabular-nums ${
                  budgetRemaining !== null && budgetRemaining < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-brand dark:text-white"
                }`}
              >
                {formatCurrency(Math.abs(budgetRemaining ?? 0))}
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-brand/10 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-base font-semibold text-brand dark:text-white">
              Category breakdown
            </h2>
            <CategoryChart transactions={transactions} />
          </section>

          <section className="rounded-2xl border border-brand/10 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-brand dark:text-white">
                Recent activity
              </h2>
              {transactions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab("transactions")}
                  className="text-sm font-medium text-brand hover:text-brand-deep dark:text-gold"
                >
                  View all
                </button>
              )}
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/5 text-brand">
                  <WalletIcon />
                </div>
                <p className="font-medium text-zinc-700 dark:text-zinc-300">
                  No activity this month
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Start the ledger with an income or expense.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("transactions")}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/20 transition hover:bg-brand-deep"
                >
                  Add a transaction
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-brand/5 dark:divide-zinc-800">
                {recentTransactions.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base ${
                        entry.type === "income"
                          ? "bg-brand/10"
                          : "bg-rose-50 dark:bg-rose-950/40"
                      }`}
                    >
                      {entry.categoryIcon || "📌"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                        {entry.description || "No description"}
                      </p>
                      <p className="text-xs text-zinc-500">{entry.category}</p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        entry.type === "income"
                          ? "text-brand"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {entry.type === "income" ? "+" : ""}
                      {formatCurrency(entry.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "transactions" &&
        (signedIn ? (
          <div className="space-y-6">
            <TransactionForm
              key={editing?.id ?? "new"}
              year={year}
              month={month}
              editing={editing}
              onSaved={handleSaved}
              onCancelEdit={() => setEditing(null)}
              onError={(message) => showToast(message, { kind: "error" })}
            />
            <TransactionList
              transactions={transactions}
              onEdit={handleEdit}
              onDeleted={(id) => {
                setTransactions((prev) => prev.filter((t) => t.id !== id));
                showToast("Transaction deleted.", { kind: "success" });
              }}
              onError={(message) => showToast(message, { kind: "error" })}
            />
          </div>
        ) : (
          <section className="rounded-2xl border border-brand/10 bg-white p-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-brand dark:text-white">
              Transactions
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to add and manage your transactions.
            </p>
          </section>
        ))}

      {tab === "calendar" &&
        (signedIn ? (
          <CalendarView year={year} month={month} />
        ) : (
          <section className="rounded-2xl border border-brand/10 bg-white p-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-brand dark:text-white">
              Calendar view
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to view your transaction calendar.
            </p>
          </section>
        ))}

      {tab === "budgets" && (
        signedIn ? (
          <BudgetPanel
            year={year}
            month={month}
            budgets={budgets}
            transactions={transactions}
            onBudgetsChange={setBudgets}
            onError={(message) => showToast(message, { kind: "error" })}
          />
        ) : (
          <section className="rounded-2xl border border-brand/10 bg-white p-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-brand dark:text-white">
              Budgets
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to set and track your monthly budgets.
            </p>
          </section>
        )
      )}
    </div>
    </>
  );
}
