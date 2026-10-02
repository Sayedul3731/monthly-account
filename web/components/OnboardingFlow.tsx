"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  fetchDashboard,
  fetchMe,
  fetchCategories,
  fetchTransactionTypes,
  fetchOnboardingEntries,
  saveOnboardingEntry,
  updateOnboarding,
  upsertBudget,
  type ApiCategory,
  type ApiTransactionType,
  type Budget,
} from "@/lib/api";
import { getAccessToken, needsOnboarding, type AuthUser } from "@/lib/auth";
import {
  formatCurrency,
  monthDateBounds,
  toDateInputValue,
  type Transaction,
  type TransactionType,
} from "@/lib/finance";
import {
  CATEGORY_LABELS,
  ONBOARDING_STEPS,
  onboardingDate,
  onboardingErrorMessage,
  parseOnboardingAmount,
  summarizeOnboarding,
} from "@/lib/onboarding";
import LoadingState from "./LoadingState";
import {
  CheckIcon,
  ChevronLeft,
  ChevronRight,
  SpinnerIcon,
  WalletIcon,
} from "./icons";

const INPUT_CLASS =
  "min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white";
const PRIMARY_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-base font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_CLASS =
  "min-h-11 rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800";
const EMPTY_ENTRIES = { income: null, expense: null };

function errorMessage(error: unknown): string {
  return onboardingErrorMessage(error, navigator.onLine);
}

export default function OnboardingFlow() {
  const router = useRouter();
  const formId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [step, setStep] = useState(0);
  const [period, setPeriod] = useState(() =>
    toDateInputValue(new Date()).slice(0, 7),
  );
  const [income, setIncome] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [expense, setExpense] = useState("");
  const [incomeCategory, setIncomeCategory] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [incomeDate, setIncomeDate] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<
    ApiTransactionType[]
  >([]);
  const [entries, setEntries] = useState<{
    income: Transaction | null;
    expense: Transaction | null;
  }>(EMPTY_ENTRIES);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [summaryReady, setSummaryReady] = useState(false);
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7)) - 1;
  const monthLabel = new Intl.DateTimeFormat("bn-BD", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
  const bounds = monthDateBounds(year, month);
  const totals = summarizeOnboarding(transactions, budgets);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let active = true;
    void (async () => {
      try {
        let me = await fetchMe();
        if (!active) return;
        if (!needsOnboarding(me)) {
          router.replace("/");
          return;
        }
        setUser(me);
        // Keep the same month when setup is resumed across a month boundary.
        if (!me.onboardingPeriod)
          me = await updateOnboarding({
            period: toDateInputValue(new Date()).slice(0, 7),
          });
        if (!active) return;
        if (!needsOnboarding(me)) {
          router.replace("/");
          return;
        }
        const savedPeriod =
          me.onboardingPeriod ?? toDateInputValue(new Date()).slice(0, 7);
        const [catalog, types, savedEntries, dashboard] = await Promise.all([
          fetchCategories(),
          fetchTransactionTypes(),
          fetchOnboardingEntries(),
          fetchDashboard(
            Number(savedPeriod.slice(0, 4)),
            Number(savedPeriod.slice(5, 7)) - 1,
          ),
        ]);
        if (!active) return;
        setUser(me);
        setPeriod(savedPeriod);
        setStep(Math.min(4, Math.max(0, me.onboardingStep ?? 0)));
        setCategories(catalog);
        setTransactionTypes(types);
        setEntries(savedEntries);
        setIncome(
          savedEntries.income ? String(savedEntries.income.amount) : "",
        );
        setExpense(
          savedEntries.expense ? String(savedEntries.expense.amount) : "",
        );
        setExpenseNote(savedEntries.expense?.description ?? "");
        const overall = dashboard.budgets.find(
          (budget) => budget.category === "",
        );
        setBudgetAmount(overall ? String(overall.amount) : "");
        setIncomeCategory(
          savedEntries.income?.categoryId ??
            catalog.find(
              (category) =>
                category.type === "income" && category.name === "Salary",
            )?.id ??
            catalog.find((category) => category.type === "income")?.id ??
            "",
        );
        setExpenseCategory(
          savedEntries.expense?.categoryId ??
            catalog.find(
              (category) =>
                category.type === "expense" && category.name === "Food",
            )?.id ??
            catalog.find((category) => category.type === "expense")?.id ??
            "",
        );
        const defaultDate = onboardingDate(
          savedPeriod,
          toDateInputValue(new Date()),
        );
        setIncomeDate(savedEntries.income?.date.slice(0, 10) ?? defaultDate);
        setExpenseDate(savedEntries.expense?.date.slice(0, 10) ?? defaultDate);
        setTransactions(dashboard.transactions);
        setBudgets(dashboard.budgets);
        setSummaryReady(true);
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        if (!getAccessToken()) {
          router.replace("/login");
          return;
        }
        setLoadError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadAttempt, router]);

  useEffect(() => {
    if (loading || loadError) return;
    if (step > 0 && step < 4) amountInput.current?.focus();
    else heading.current?.focus();
  }, [loading, loadError, step]);

  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function refreshSummary() {
    setSummaryReady(false);
    const dashboard = await fetchDashboard(year, month);
    setTransactions(dashboard.transactions);
    setBudgets(dashboard.budgets);
    setSummaryReady(true);
  }

  async function advance(next: number) {
    const updated = await updateOnboarding({ step: next });
    if (!needsOnboarding(updated)) {
      router.replace("/");
      return;
    }
    setUser(updated);
    setStep(next);
    if (next === 4) await refreshSummary();
  }

  async function saveAmount(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseOnboardingAmount(
      step === 1 ? income : step === 2 ? budgetAmount : expense,
    );
    if (amount === null) {
      setError(
        "সঠিক টাকার পরিমাণ লিখুন—কমপক্ষে ৳0.01, দশমিকের পরে সর্বোচ্চ দুই ঘর।",
      );
      amountInput.current?.focus();
      return;
    }
    if (step === 3 && (expenseDate < bounds.min || expenseDate > bounds.max)) {
      setError("এই মাসের মধ্যে একটি তারিখ বেছে নিন।");
      return;
    }
    await run(async () => {
      if (step === 2) {
        const budget = await upsertBudget({ year, month, amount });
        setBudgets((current) => [
          ...current.filter((entry) => entry.category !== ""),
          budget,
        ]);
      } else {
        const kind: TransactionType = step === 1 ? "income" : "expense";
        const transactionType = transactionTypes.find(
          (entry) => entry.name === kind,
        );
        const categoryId = kind === "income" ? incomeCategory : expenseCategory;
        if (
          !transactionType ||
          !categories.some(
            (category) => category.id === categoryId && category.type === kind,
          )
        ) {
          setError(
            "এই লেনদেনের ক্যাটাগরি পাওয়া যায়নি। আবার তথ্য লোড করুন বা পরে যোগ করুন।",
          );
          return;
        }
        const entry = await saveOnboardingEntry(kind, {
          transactionTypeId: transactionType.id,
          categoryId,
          amount,
          description:
            kind === "income"
              ? (entries.income?.description ?? "মাসিক আয়")
              : expenseNote.trim() || null,
          date: kind === "income" ? incomeDate : expenseDate,
        });
        setEntries((current) => ({ ...current, [kind]: entry }));
        setTransactions((current) => [
          ...current.filter((item) => item.id !== entry.id),
          entry,
        ]);
      }
      await advance(step + 1);
    });
  }

  function finish(status: "completed" | "skipped") {
    void run(async () => {
      const updated = await updateOnboarding({ status });
      const savedPeriod = updated.onboardingPeriod ?? period;
      router.replace(`/?month=${savedPeriod}`);
    });
  }

  function retry() {
    setLoading(true);
    setLoadError(null);
    setError(null);
    setLoadAttempt((value) => value + 1);
  }

  if (loading) return <LoadingState label="আপনার হিসাব লোড হচ্ছে" />;
  const currentAmount =
    step === 1 ? income : step === 2 ? budgetAmount : expense;
  const savedAmount =
    step === 1
      ? entries.income?.amount
      : step === 2
        ? totals.budget
        : entries.expense?.amount;
  const previewExpense = parseOnboardingAmount(expense);
  const previewRemaining =
    totals.budget === null || previewExpense === null
      ? null
      : (Math.round(totals.budget * 100) -
          Math.round(totals.spent * 100) +
          Math.round((entries.expense?.amount ?? 0) * 100) -
          Math.round(previewExpense * 100)) /
        100;
  const spentPercent = totals.budget
    ? Math.min(100, Math.max(0, (totals.spent / totals.budget) * 100))
    : 0;

  return (
    <main
      lang="bn"
      className="min-h-[100dvh] bg-[#f5f7f5] px-4 py-5 text-zinc-900 dark:bg-[#071815] dark:text-white sm:px-8 sm:py-10"
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/doinik-hisab-logo.png"
            alt=""
            width={40}
            height={40}
            className="rounded-xl bg-white object-contain p-1"
            priority
          />
          <span className="text-sm font-semibold sm:text-base">
            Doinik Hisab
          </span>
        </div>
        {user && (
          <button
            disabled={saving}
            onClick={() => finish("skipped")}
            className={SECONDARY_CLASS}
          >
            সেটআপ বাদ দিন
          </button>
        )}
      </header>

      <div className="mx-auto mt-7 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-[0_24px_80px_-45px_rgba(15,61,56,0.4)] dark:border-zinc-800 dark:bg-zinc-900 md:mt-12 md:grid-cols-[0.85fr_1.15fr]">
        <aside className="bg-[#103d38] p-6 text-white sm:p-9 md:p-10">
          <p className="text-sm font-medium text-emerald-200">
            আপনার টাকার গল্প, আপনার হাতে
          </p>
          <h2 className="mt-3 text-2xl font-semibold leading-relaxed sm:text-3xl">
            ছোট্ট শুরু।
            <br />
            মাসের পরিষ্কার হিসাব।
          </h2>
          <p className="mt-3 max-w-xs text-sm leading-7 text-emerald-50/75">
            আয়, বাজেট আর একটি খরচ—এই তিনটি তথ্যেই বুঝে নিন কত খরচ হলো, আর কতটা
            বাকি।
          </p>
          <ol
            aria-label="সেটআপের ধাপ"
            className="mt-6 flex gap-2 md:mt-9 md:flex-col md:gap-4"
          >
            {ONBOARDING_STEPS.map((label, index) => (
              <li
                key={label}
                aria-current={step === index ? "step" : undefined}
                className="flex flex-1 items-center gap-3"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${index <= step ? "bg-emerald-200 text-emerald-950" : "bg-white/10 text-white/60"}`}
                >
                  {index < step ? <CheckIcon /> : index + 1}
                </span>
                <span
                  className={`hidden text-sm md:block ${index <= step ? "text-white" : "text-white/50"}`}
                >
                  {label}
                </span>
                <span className="sr-only md:hidden">{label}</span>
              </li>
            ))}
          </ol>
          <div className="mt-10 hidden rounded-2xl border border-white/10 bg-white/5 p-5 md:block">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-100">
              <WalletIcon />
              {monthLabel}
            </div>
            <p className="mt-3 text-sm leading-7 text-emerald-50/65">
              আপনার দেওয়া তথ্যই হিসাবে থাকবে। পরে যেকোনো লেনদেন বা বাজেট
              পরিবর্তন করতে পারবেন।
            </p>
          </div>
        </aside>

        <section
          aria-busy={saving}
          className="flex min-w-0 flex-col p-6 sm:p-9 md:min-h-[560px] md:p-10"
        >
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {step === 0
              ? "এক মিনিটেই শুরু"
              : step === 4
                ? monthLabel
                : `ধাপ ${step} / ৩ · ${monthLabel}`}
          </p>
          <h1
            ref={heading}
            tabIndex={-1}
            className="mt-3 text-2xl font-semibold leading-relaxed tracking-tight outline-none sm:text-3xl"
          >
            {step === 0
              ? "Doinik Hisab-এ স্বাগতম 👋"
              : step === 1
                ? "আপনার মাসিক আয় কত?"
                : step === 2
                  ? "এই মাসের বাজেট কত?"
                  : step === 3
                    ? "আপনার প্রথম খরচ যোগ করুন"
                    : "🎉 আপনার মাসিক হিসাব প্রস্তুত!"}
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
            {step === 0
              ? "চলুন, আপনার প্রথম মাসের হিসাব তৈরি করি। মাত্র তিনটি সহজ ধাপে আপনার টাকার অবস্থা দেখতে পাবেন।"
              : step === 1
                ? "এই টাকা এই মাসের আয় হিসেবে হিসাবে যোগ হবে। পরে আয় পরিবর্তন বা নতুন আয় যোগ করতে পারবেন।"
                : step === 2
                  ? "এই মাসে মোট কত টাকা খরচ করতে চান? এই সীমার সঙ্গে আপনার খরচ তুলনা করব।"
                  : step === 3
                    ? "চা, বাজার বা যাতায়াত—যেকোনো একটি খরচ দিয়ে শুরু করুন।"
                    : "এখন এক নজরেই বুঝতে পারবেন আপনার খরচ আর বাজেটের অবস্থা।"}
          </p>

          {loadError && (
            <div
              role="alert"
              className="mt-5 rounded-xl bg-rose-50 p-4 text-sm leading-7 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <p>{loadError}</p>
              <button className={`${SECONDARY_CLASS} mt-2`} onClick={retry}>
                আবার চেষ্টা করুন
              </button>
              {!user && (
                <Link href="/login" className="ml-4 underline">
                  সাইন ইন করুন
                </Link>
              )}
            </div>
          )}
          {error && (
            <p
              id={`${formId}-error`}
              role="alert"
              className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-7 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {error}
            </p>
          )}

          {!loadError && step === 0 && (
            <div className="mt-7 flex flex-1 flex-col">
              <div className="space-y-4 rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-950/40">
                {[
                  "মাসিক আয় যোগ করুন",
                  "মাসের খরচের সীমা ঠিক করুন",
                  "প্রথম খরচেই বাকি বাজেট দেখুন",
                ].map((label, index) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 text-sm leading-6"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                      {index + 1}
                    </span>
                    {label}
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-8">
                <button
                  disabled={saving}
                  onClick={() => void run(() => advance(1))}
                  className={PRIMARY_CLASS}
                >
                  {saving ? (
                    <SpinnerIcon className="animate-spin" />
                  ) : (
                    <ChevronRight />
                  )}
                  চলুন শুরু করি
                </button>
              </div>
            </div>
          )}

          {!loadError && step > 0 && step < 4 && (
            <form
              onSubmit={saveAmount}
              noValidate
              className="mt-7 flex flex-1 flex-col"
            >
              <label
                htmlFor={`${formId}-amount`}
                className="mb-2 text-sm font-medium"
              >
                {step === 1
                  ? "মাসিক আয়"
                  : step === 2
                    ? "মাসের বাজেট"
                    : "খরচের পরিমাণ"}{" "}
                (৳)
              </label>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-3.5 left-4 text-2xl text-zinc-400"
                >
                  ৳
                </span>
                <input
                  ref={amountInput}
                  id={`${formId}-amount`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={20}
                  value={currentAmount}
                  placeholder={step === 3 ? "500" : "30,000"}
                  disabled={saving}
                  onChange={(event) => {
                    if (step === 1) setIncome(event.target.value);
                    else if (step === 2) setBudgetAmount(event.target.value);
                    else setExpense(event.target.value);
                    setError(null);
                  }}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={`${formId}-amount-help${error ? ` ${formId}-error` : ""}`}
                  className={`${INPUT_CLASS} pl-10 text-2xl font-medium`}
                />
              </div>
              {step === 2 && (
                <div
                  className="mt-3 flex flex-wrap gap-2"
                  aria-label="বাজেটের পরিমাণ বেছে নিন"
                >
                  {[20000, 30000, 40000].map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setBudgetAmount(String(value));
                        setError(null);
                      }}
                      className="min-h-10 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      {formatCurrency(value)}
                    </button>
                  ))}
                </div>
              )}
              {(step === 1 || step === 3) && (
                <div className="mt-5">
                  <label
                    htmlFor={`${formId}-category`}
                    className="mb-2 block text-sm font-medium"
                  >
                    {step === 1 ? "আয়ের উৎস" : "কিসের খরচ?"}
                  </label>
                  <select
                    id={`${formId}-category`}
                    value={step === 1 ? incomeCategory : expenseCategory}
                    onChange={(event) => {
                      if (step === 1) setIncomeCategory(event.target.value);
                      else setExpenseCategory(event.target.value);
                    }}
                    disabled={saving}
                    className={`${INPUT_CLASS} text-base`}
                  >
                    {categories
                      .filter(
                        (category) =>
                          category.type === (step === 1 ? "income" : "expense"),
                      )
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {CATEGORY_LABELS[category.name] ?? category.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {step === 3 && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer py-2 text-zinc-500 dark:text-zinc-400">
                    তারিখ ও নোট (ঐচ্ছিক)
                  </summary>
                  <div className="mt-3 grid gap-3">
                    <label htmlFor={`${formId}-date`}>খরচের তারিখ</label>
                    <input
                      id={`${formId}-date`}
                      type="date"
                      value={expenseDate}
                      min={bounds.min}
                      max={bounds.max}
                      onChange={(event) => setExpenseDate(event.target.value)}
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                    <label htmlFor={`${formId}-note`}>ছোট্ট নোট</label>
                    <input
                      id={`${formId}-note`}
                      value={expenseNote}
                      onChange={(event) => setExpenseNote(event.target.value)}
                      maxLength={255}
                      placeholder="যেমন: আজকের বাজার"
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  </div>
                </details>
              )}
              <p
                id={`${formId}-amount-help`}
                className="mt-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400"
              >
                {savedAmount != null
                  ? "এই ধাপে আগে দেওয়া তথ্যটি পরিবর্তন হবে; নতুন করে দ্বিগুণ যোগ হবে না।"
                  : "বাংলা বা ইংরেজি সংখ্যায় লিখতে পারেন। সংরক্ষণ করলে আপনার হিসাবে যোগ হবে।"}
              </p>
              {step === 3 && previewRemaining !== null && (
                <div className="mt-4 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    পূর্বরূপ · এই খরচ যোগ করলে
                  </p>
                  <p
                    className={`mt-1 font-medium ${previewRemaining < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-800 dark:text-emerald-200"}`}
                  >
                    {previewRemaining < 0
                      ? `বাজেট ছাড়াবে ${formatCurrency(previewRemaining)}`
                      : `বাকি থাকবে ${formatCurrency(previewRemaining)}`}
                  </p>
                </div>
              )}
              <div className="mt-auto pt-6">
                <button disabled={saving} className={PRIMARY_CLASS}>
                  {saving ? (
                    <SpinnerIcon className="animate-spin" />
                  ) : (
                    <ChevronRight />
                  )}
                  {step === 3
                    ? "খরচ যোগ করে হিসাব দেখুন"
                    : "সংরক্ষণ করে এগিয়ে যান"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void run(() => advance(step + 1))}
                  className={`${SECONDARY_CLASS} mt-2 w-full`}
                >
                  {savedAmount != null
                    ? "পরিবর্তন ছাড়াই এগিয়ে যান"
                    : "পরে যোগ করব"}
                </button>
              </div>
            </form>
          )}

          {!loadError && step === 4 && (
            <div className="mt-7 flex flex-1 flex-col">
              {summaryReady ? (
                <>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      <CheckIcon />
                      {monthLabel}
                    </div>
                    <dl className="mt-5 space-y-4">
                      <div className="flex justify-between gap-3 text-sm">
                        <dt className="text-zinc-500 dark:text-zinc-400">
                          মাসের বাজেট
                        </dt>
                        <dd className="font-semibold">
                          {totals.budget === null
                            ? "এখনও দেওয়া হয়নি"
                            : formatCurrency(totals.budget)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 text-sm">
                        <dt className="text-zinc-500 dark:text-zinc-400">
                          মোট খরচ
                        </dt>
                        <dd className="font-semibold">
                          {formatCurrency(totals.spent)}
                        </dd>
                      </div>
                      <div className="border-t border-emerald-200/70 pt-4 dark:border-emerald-900">
                        <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                          {totals.remaining !== null && totals.remaining < 0
                            ? "বাজেট ছাড়িয়েছে"
                            : "বাকি বাজেট"}
                        </dt>
                        <dd
                          className={`mt-2 text-3xl font-semibold sm:text-4xl ${totals.remaining !== null && totals.remaining < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-800 dark:text-emerald-200"}`}
                        >
                          {totals.remaining === null
                            ? "বাজেট যোগ করুন"
                            : formatCurrency(totals.remaining)}
                        </dd>
                      </div>
                    </dl>
                    {totals.budget !== null && (
                      <div
                        className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-200/60 dark:bg-emerald-900"
                        role="progressbar"
                        aria-label="বাজেটের খরচ"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(spentPercent)}
                      >
                        <div
                          className={`h-full rounded-full ${totals.remaining !== null && totals.remaining < 0 ? "bg-rose-500" : "bg-emerald-600"}`}
                          style={{ width: `${spentPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <p className="mt-4 flex justify-between gap-4 text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      এই মাসের মোট আয়
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(totals.income)}
                    </span>
                  </p>
                  <p className="mt-4 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                    {totals.budget === null
                      ? "ড্যাশবোর্ডের বাজেট অংশ থেকে খরচের সীমা যোগ করতে পারবেন।"
                      : totals.remaining !== null && totals.remaining < 0
                        ? "আপনার খরচ বাজেটের চেয়ে বেশি। ড্যাশবোর্ড থেকে খরচ দেখুন বা বাজেট পরিবর্তন করুন।"
                        : "প্রতিটি নতুন খরচ যোগ করলেই এই হিসাব আপডেট হবে। এখন থেকে সব খরচ এক জায়গায় রাখুন।"}
                  </p>
                </>
              ) : (
                <div className="py-5">
                  <LoadingState compact label="মাসিক হিসাব আপডেট হচ্ছে" />
                  {!saving && (
                    <button
                      onClick={() => void run(refreshSummary)}
                      className={PRIMARY_CLASS}
                    >
                      আবার হিসাব দেখুন
                    </button>
                  )}
                </div>
              )}
              <div className="mt-auto pt-7">
                <button
                  disabled={saving || !summaryReady}
                  onClick={() => finish("completed")}
                  className={PRIMARY_CLASS}
                >
                  {saving ? (
                    <SpinnerIcon className="animate-spin" />
                  ) : (
                    <ChevronRight />
                  )}
                  মাসিক হিসাব দেখুন
                </button>
              </div>
            </div>
          )}
          {!loadError && step > 0 && (
            <button
              disabled={saving}
              onClick={() => {
                setError(null);
                setStep(step - 1);
              }}
              className={`${SECONDARY_CLASS} mt-4 flex w-fit items-center gap-1 pl-0`}
            >
              <ChevronLeft />
              পেছনে
            </button>
          )}
        </section>
      </div>
      <p className="mx-auto mt-5 max-w-5xl text-center text-xs leading-6 text-zinc-500 dark:text-zinc-400">
        প্রতিটি ধাপের তথ্য সংরক্ষিত থাকে। অসমাপ্ত সেটআপে ফিরে এলে আগের ধাপ থেকে
        চালিয়ে যেতে পারবেন।
      </p>
    </main>
  );
}
