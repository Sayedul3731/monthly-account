"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import LoadingState from "./LoadingState";
import {
  fetchDashboard,
  fetchTransactions,
  logoutUser,
  type Budget,
} from "@/lib/api";
import { getAccessToken, getStoredUser, isAdmin } from "@/lib/auth";
import {
  getOfflineAccount,
  saveOfflineAccount,
  saveOfflineTransactions,
  syncOfflineTransactions,
} from "@/lib/offline-ledger";
import {
  formatCurrency,
  formatMonthLabel,
  summarize,
  type Transaction,
} from "@/lib/finance";
import { getMonthlyInsight } from "@/lib/monthly-insights";
import { downloadMonthlyStatementPdf } from "@/lib/monthly-statement";
import AppHeader from "./AppHeader";
import CategoryChart from "./CategoryChart";
import MonthlyInsight from "./MonthlyInsight";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  PlusIcon,
  WalletIcon,
} from "./icons";
import { useToast } from "@/components/ToastProvider";

const BudgetPanel = dynamic(() => import("./BudgetPanel"));
const CalendarView = dynamic(() => import("./CalendarView"));
const ExportImportPanel = dynamic(() => import("./ExportImportPanel"));
const TransactionForm = dynamic(() => import("./TransactionForm"));
const TransactionList = dynamic(() => import("./TransactionList"));
const RecurringExpensesPanel = dynamic(
  () => import("./RecurringExpensesPanel"),
);

const today = new Date();

type Tab = "overview" | "transactions" | "recurring" | "calendar" | "budgets";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "recurring", label: "Recurring" },
  { id: "calendar", label: "Calendar View" },
  { id: "budgets", label: "Budgets" },
];

export default function MonthlyAccount() {
  const router = useRouter();
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [previousTransactions, setPreviousTransactions] = useState<
    Transaction[]
  >([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [focusTransactionForm, setFocusTransactionForm] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [sessionUser, setSessionUser] =
    useState<ReturnType<typeof getStoredUser>>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [offline, setOffline] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [exportingOverviewPdf, setExportingOverviewPdf] = useState(false);
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);
  const transactionFormRef = useRef<HTMLDivElement>(null);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logoutUser();
      setSignedIn(false);
      setSessionUser(null);
      setTransactions([]);
      setPreviousTransactions([]);
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
      setPreviousTransactions([]);
      const cached = getOfflineAccount(sessionUser?.id ?? "", year, month);
      if (cached) {
        setTransactions(cached.transactions);
        setBudgets(cached.budgets);
        setLoading(false);
      }

      try {
        const dashboard = await fetchDashboard(year, month);
        if (cancelled) return;

        setTransactions(dashboard.transactions);
        setBudgets(dashboard.budgets);
        setUnreadNotificationCount(dashboard.unreadNotificationCount);
        if (sessionUser?.id) {
          saveOfflineAccount(
            sessionUser.id,
            year,
            month,
            dashboard.transactions,
            dashboard.budgets,
          );
        }
        setOffline(false);

        const previousMonth = new Date(year, month - 1, 1);
        try {
          const previous = await fetchTransactions(
            previousMonth.getFullYear(),
            previousMonth.getMonth(),
          );
          if (!cancelled) setPreviousTransactions(previous);
        } catch {
          // The overview remains useful without a month-over-month comparison.
          if (!cancelled) setPreviousTransactions([]);
        }
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error ? err.message : "Failed to load account";
        if (
          message ===
          "Your 15-day trial or Premium plan has ended. Choose Premium to continue."
        ) {
          router.replace("/membership");
          return;
        }

        // `navigator.onLine` reflects the browser's network state. An API,
        // CORS, or server error can happen while the device is still online,
        // so it must not be presented as an offline state.
        if (cached && !navigator.onLine) {
          setOffline(true);
          showToast("You are offline. Showing your last saved account data.", {
            kind: "error",
            title: "Offline mode",
          });
        } else {
          setOffline(false);
          showToast(message, {
            kind: "error",
            title: "Could not load account",
          });
          if (!cached) {
            setTransactions([]);
            setBudgets([]);
            setPreviousTransactions([]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [authReady, month, router, sessionUser?.id, showToast, signedIn, year]);

  useEffect(() => {
    const userId = sessionUser?.id ?? "";
    if (!authReady || !signedIn) return;
    if (!userId) return;

    let cancelled = false;
    async function syncPending() {
      if (!navigator.onLine) {
        setOffline(true);
        return;
      }

      try {
        const synced = await syncOfflineTransactions(userId);
        if (cancelled) return;
        if (synced.length) {
          const cached = getOfflineAccount(userId, year, month);
          if (cached) setTransactions(cached.transactions);
          showToast(
            `${synced.length} offline transaction${synced.length === 1 ? "" : "s"} synced.`,
            { kind: "success" },
          );
        }
        setOffline(false);
      } catch {
        // Keep queued transactions locally and retry on the next online event.
      }
    }

    function handleOnline() {
      void syncPending();
    }

    function handleOffline() {
      setOffline(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void syncPending();
    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [authReady, month, sessionUser?.id, showToast, signedIn, year]);

  useEffect(() => {
    if (!focusTransactionForm || tab !== "transactions") return;

    const frameId = window.requestAnimationFrame(() => {
      transactionFormRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      setFocusTransactionForm(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [focusTransactionForm, tab]);

  const stats = useMemo(() => summarize(transactions), [transactions]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();
  const elapsedDays = isCurrentMonth ? today.getDate() : daysInMonth;
  const monthProgress = (elapsedDays / daysInMonth) * 100;
  const daysLeft = isCurrentMonth
    ? Math.max(daysInMonth - today.getDate(), 0)
    : 0;

  const overallBudget = budgets.find((budget) => !budget.category);
  const budgetRemaining = overallBudget
    ? overallBudget.amount - stats.expenses
    : null;
  const budgetUsedPercent =
    overallBudget && overallBudget.amount > 0
      ? (stats.expenses / overallBudget.amount) * 100
      : null;
  const currentBudgetUsage = budgetUsedPercent ?? 0;
  const budgetProgress = Math.min(budgetUsedPercent ?? 0, 100);
  const isOverBudget = budgetRemaining !== null && budgetRemaining < 0;
  const monthlyInsight = useMemo(
    () =>
      getMonthlyInsight({
        transactions,
        previousTransactions,
        budgetRemaining,
        budgetUsedPercent,
      }),
    [budgetRemaining, budgetUsedPercent, previousTransactions, transactions],
  );
  const budgetAlert =
    budgetUsedPercent === null
      ? null
      : budgetUsedPercent >= 100
        ? {
            message: "🔴 আপনার মাসিক বাজেট অতিক্রম হয়েছে।",
            className: "border-rose-300/30 bg-rose-400/15 text-rose-50",
          }
        : budgetUsedPercent >= 90
          ? {
              message: "🔴 এই মাসের বাজেট প্রায় শেষ।",
              className: "border-rose-300/30 bg-rose-400/15 text-rose-50",
            }
          : budgetUsedPercent >= 80
            ? {
                message: "🟡 আপনার বাজেটের 80% ব্যবহার হয়েছে।",
                className: "border-amber-200/30 bg-amber-300/15 text-amber-50",
              }
            : {
                message: "🟢 আপনি বাজেটের মধ্যে আছেন।",
                className:
                  "border-emerald-200/30 bg-emerald-300/15 text-emerald-50",
              };

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
    queuedOffline = false,
  ) {
    const wasEditing = Boolean(editing);
    setEditing(null);
    setQuickExpenseOpen(false);

    showToast(
      queuedOffline
        ? "Saved offline. It will sync automatically when you reconnect."
        : wasEditing
          ? "Transaction updated."
          : "Transaction added.",
      { kind: "success" },
    );

    if (navigatedMonth) {
      if (sessionUser?.id) {
        const cached = getOfflineAccount(
          sessionUser.id,
          navigatedMonth.year,
          navigatedMonth.month,
        );
        saveOfflineTransactions(
          sessionUser.id,
          navigatedMonth.year,
          navigatedMonth.month,
          [
            entry,
            ...(cached?.transactions ?? []).filter(
              (transaction) => transaction.id !== entry.id,
            ),
          ],
        );
      }
      setLoading(true);
      setYear(navigatedMonth.year);
      setMonth(navigatedMonth.month);
      return;
    }

    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === entry.id);
      const next = exists
        ? prev.map((t) => (t.id === entry.id ? entry : t))
        : [entry, ...prev];
      if (sessionUser?.id) {
        saveOfflineTransactions(sessionUser.id, year, month, next);
      }
      return next;
    });
  }

  function handleEdit(transaction: Transaction) {
    setEditing(transaction);
    setTab("transactions");
    setFocusTransactionForm(true);
  }

  function showTransactions() {
    setTab("transactions");
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  }

  function openNewTransaction() {
    setEditing(null);
    setTab("transactions");
    setFocusTransactionForm(true);
  }

  function openQuickExpense() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    setEditing(null);
    setQuickExpenseOpen(true);
  }

  async function handleImportedTransactions() {
    setLoading(true);
    try {
      setTransactions(await fetchTransactions(year, month));
      showToast("Transactions imported successfully.", { kind: "success" });
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Imported transactions could not be loaded.",
        { kind: "error", title: "Import completed with a refresh error" },
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRecurringChanged() {
    try {
      const dashboard = await fetchDashboard(year, month);
      setTransactions(dashboard.transactions);
      setBudgets(dashboard.budgets);
      if (sessionUser?.id) {
        saveOfflineAccount(
          sessionUser.id,
          year,
          month,
          dashboard.transactions,
          dashboard.budgets,
        );
      }
    } catch {
      // The schedule itself has already been saved; the normal dashboard
      // refresh will generate and display its transaction on the next load.
    }
  }

  async function downloadOverviewReport() {
    if (exportingOverviewPdf || transactions.length === 0) return;
    setExportingOverviewPdf(true);
    try {
      await downloadMonthlyStatementPdf({ year, month, transactions, budgets });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "PDF export failed", {
        kind: "error",
        title: "Could not create statement",
      });
    } finally {
      setExportingOverviewPdf(false);
    }
  }

  const header = (
    <AppHeader
      signedIn={signedIn}
      user={
        sessionUser
          ? {
              name: sessionUser.name,
              email: sessionUser.email,
              membership: sessionUser.membership,
              trialEndsAt: sessionUser.trialEndsAt,
              planEndsAt: sessionUser.planEndsAt,
            }
          : null
      }
      isAdmin={isAdmin(sessionUser)}
      unreadNotificationCount={unreadNotificationCount}
      signingOut={signingOut}
      onSignOut={handleSignOut}
      ready={authReady}
    />
  );

  if (loading && (!authReady || signedIn)) {
    return (
      <>
        {header}
        <LoadingState label="Loading your daily account" />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mx-auto w-full max-w-2xl px-3 py-3 pb-28 sm:px-6 sm:py-5 sm:pb-28">
        {offline && (
          <div
            className="mb-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
            aria-live="polite"
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
                <path
                  d="M2 8.82a15.91 15.91 0 0 1 20 0M5 12.85a10.94 10.94 0 0 1 14 0M8.7 16.55a5.89 5.89 0 0 1 6.6 0"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M3 3l18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <p className="leading-5">
              <span className="font-semibold">You&apos;re offline.</span>{" "}
              You&apos;re viewing saved data. New changes will be stored on this
              device and sync automatically when you reconnect.
            </p>
          </div>
        )}
        <header className="mb-3 flex flex-col gap-1.5 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div>
            <h1 className="mt-0.5 text-lg font-semibold leading-tight tracking-tight text-brand sm:text-xl dark:text-white">
              আপনার টাকা কোথায় যাচ্ছে জানুন
            </h1>
            <p className="mt-0.5 text-[11px] leading-4 text-zinc-500 sm:text-xs dark:text-zinc-400">
              আয়, খরচ ও সঞ্চয়ের পুরো হিসাব এক জায়গায়।
            </p>
          </div>
          {tab !== "calendar" && (
            <div className="flex items-center gap-0.5 self-start rounded-full border border-brand/15 bg-white p-px shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:gap-1 sm:p-0.5 sm:self-auto">
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
            </div>
          )}
        </header>

        <nav
          className={`${tab === "overview" && monthlyInsight ? "mb-1" : "mb-1"} flex gap-1 overflow-x-auto rounded-xl border border-brand/10 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900`}
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() =>
                id === "transactions" ? openNewTransaction() : setTab(id)
              }
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
            {monthlyInsight && (
              <div className="!mb-2">
                <MonthlyInsight insight={monthlyInsight} />
              </div>
            )}

            <section
              className={`relative overflow-hidden rounded-3xl bg-brand bg-gradient-to-br from-brand via-brand to-brand-deep p-6 text-white shadow-xl shadow-brand/25 ${monthlyInsight ? "!mt-0" : ""}`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold/40 via-gold to-gold/40" />
              <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-gold/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                    {new Intl.DateTimeFormat("bn-BD", { month: "long" }).format(
                      new Date(year, month),
                    )}
                    ের হিসাব
                  </p>
                  <p className="mt-3 text-sm font-medium text-white/70">
                    এই মাসে মোট খরচ
                  </p>
                  <p className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
                    {formatCurrency(stats.expenses)}
                  </p>
                </div>
                {overallBudget ? (
                  <span
                    className={`mt-1 shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                      isOverBudget
                        ? "border-rose-300/40 bg-rose-400/15 text-rose-100"
                        : "border-gold/40 bg-gold/15 text-gold"
                    }`}
                  >
                    {isOverBudget ? "বাজেট ছাড়িয়েছে" : "বাজেট ট্র্যাকিং"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTab("budgets")}
                    className="mt-1 shrink-0 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                  >
                    বাজেট সেট করুন
                  </button>
                )}
              </div>

              <div className="relative mt-6 grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3 backdrop-blur-sm sm:px-4">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/65 sm:text-xs">
                    বাজেট
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-white sm:text-base">
                    {overallBudget
                      ? formatCurrency(overallBudget.amount)
                      : "সেট করা হয়নি"}
                  </p>
                </div>
                <div className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-3 py-3 backdrop-blur-sm sm:px-4">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-rose-50/80 sm:text-xs">
                    খরচ
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-rose-50 sm:text-base">
                    {overallBudget ? formatCurrency(stats.expenses) : "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-3 backdrop-blur-sm sm:px-4">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-50/80 sm:text-xs">
                    {isOverBudget ? "বেশি হয়েছে" : "বাকি"}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-50 sm:text-base">
                    {budgetRemaining === null
                      ? "—"
                      : formatCurrency(Math.abs(budgetRemaining))}
                  </p>
                </div>
              </div>

              {overallBudget && budgetAlert && (
                <div className="relative mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-white/70">
                    <span>বাজেটের ব্যবহার</span>
                    <span>{currentBudgetUsage.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        currentBudgetUsage >= 90
                          ? "bg-rose-300"
                          : currentBudgetUsage >= 80
                            ? "bg-amber-300"
                            : "bg-emerald-300"
                      }`}
                      style={{ width: `${budgetProgress}%` }}
                    />
                  </div>
                  <p
                    className={`mt-3 rounded-xl border px-3 py-2 text-xs font-medium ${budgetAlert.className}`}
                    role="status"
                  >
                    {budgetAlert.message}
                  </p>
                </div>
              )}

              <div className="relative mt-5">
                <div className="mb-1.5 flex justify-between text-xs text-white/70">
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon />
                    {isCurrentMonth
                      ? `দিন ${elapsedDays} / ${daysInMonth}`
                      : `${daysInMonth} দিন`}
                  </span>
                  <span>
                    {isCurrentMonth ? `${daysLeft} দিন বাকি` : "শেষ মাস"}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gold transition-all duration-500"
                    style={{ width: `${monthProgress}%` }}
                  />
                </div>
              </div>

              <div className="relative mt-5">
                <button
                  type="button"
                  onClick={() => void downloadOverviewReport()}
                  disabled={transactions.length === 0 || exportingOverviewPdf}
                  className="rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingOverviewPdf
                    ? "Creating statement..."
                    : "Download monthly statement (PDF)"}
                </button>
              </div>
            </section>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-brand/10 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  আয়
                </p>
                <p className="mt-1 text-base font-semibold tabular-nums text-brand dark:text-white">
                  {formatCurrency(stats.income)}
                </p>
              </div>
              <div className="rounded-2xl border border-brand/10 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  নেট ব্যালেন্স
                </p>
                <p
                  className={`mt-1 text-base font-semibold tabular-nums ${
                    stats.balance < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-brand dark:text-white"
                  }`}
                >
                  {formatCurrency(stats.balance)}
                </p>
              </div>
              <div className="rounded-2xl border border-brand/10 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  লেনদেন
                </p>
                <p className="mt-1 text-base font-semibold tabular-nums text-brand dark:text-white">
                  {transactions.length}
                  <span className="ml-1 text-xs font-medium text-zinc-400">
                    টি
                  </span>
                </p>
              </div>
            </div>

            <section className="rounded-2xl border border-brand/10 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-brand dark:text-white">
                  এই মাসের খরচ কোথায় গেল?
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  ক্যাটাগরি অনুযায়ী খরচের হিসাব
                </p>
              </div>
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
                    onClick={showTransactions}
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
                    onClick={openNewTransaction}
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
                        <p className="text-xs text-zinc-500">
                          {entry.category}
                        </p>
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
              <div ref={transactionFormRef} className="scroll-mt-20">
                <TransactionForm
                  key={editing?.id ?? "new"}
                  year={year}
                  month={month}
                  editing={editing}
                  onSaved={handleSaved}
                  onCancelEdit={() => setEditing(null)}
                  onError={(message) => showToast(message, { kind: "error" })}
                />
              </div>
              <TransactionList
                transactions={transactions}
                onEdit={handleEdit}
                onDeleted={(id) => {
                  setTransactions((prev) => prev.filter((t) => t.id !== id));
                  showToast("Transaction deleted.", { kind: "success" });
                }}
                onError={(message) => showToast(message, { kind: "error" })}
              />
              <ExportImportPanel
                year={year}
                month={month}
                transactions={transactions}
                budgets={budgets}
                onImported={() => void handleImportedTransactions()}
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

        {tab === "recurring" &&
          (signedIn ? (
            <RecurringExpensesPanel
              onChanged={() => void handleRecurringChanged()}
              onError={(message) => showToast(message, { kind: "error" })}
              onSuccess={(message) => showToast(message, { kind: "success" })}
            />
          ) : (
            <section className="rounded-2xl border border-brand/10 bg-white p-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-base font-semibold text-brand dark:text-white">
                Recurring expenses
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Sign in to set expenses that repeat every month.
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

        {tab === "budgets" &&
          (signedIn ? (
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
          ))}
      </div>
      <button
        type="button"
        onClick={openQuickExpense}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/15 bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-rose-500/30 transition duration-200 hover:-translate-y-0.5 hover:bg-rose-600 hover:shadow-2xl hover:shadow-rose-500/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/30 active:translate-y-0 active:scale-[0.98] dark:border-white/10 sm:bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:right-6"
        aria-label="খরচ যোগ করুন"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/15"
          aria-hidden="true"
        >
          <PlusIcon />
        </span>
        <span>খরচ যোগ করুন</span>
      </button>
      {quickExpenseOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-zinc-950/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setQuickExpenseOpen(false);
          }}
        >
          <div
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto sm:max-h-[calc(100dvh-3rem)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-expense-title"
          >
            <TransactionForm
              key="quick-expense"
              year={year}
              month={month}
              editing={null}
              quickExpense
              onSaved={handleSaved}
              onCancelEdit={() => setQuickExpenseOpen(false)}
              onError={(message) => showToast(message, { kind: "error" })}
            />
          </div>
        </div>
      )}
    </>
  );
}
