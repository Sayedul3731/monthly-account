"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchTransactions } from "@/lib/api";
import {
  categoryBreakdown,
  formatCurrency,
  toCalendarDate,
  type Transaction,
} from "@/lib/finance";
import { useToast } from "@/components/ToastProvider";
import { CalendarIcon, ChevronLeft, ChevronRight } from "./icons";

type ViewMode = "daily" | "weekly" | "monthly" | "yearly";

const MODES: { id: ViewMode; label: string }[] = [
  { id: "daily", label: "Day" },
  { id: "weekly", label: "Week" },
  { id: "monthly", label: "Month" },
  { id: "yearly", label: "Year" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function periodBounds(mode: ViewMode, cursor: Date) {
  if (mode === "daily") {
    return { start: dateKey(cursor), end: dateKey(cursor), days: 1 };
  }
  if (mode === "weekly") {
    const start = startOfWeek(cursor);
    return { start: dateKey(start), end: dateKey(addDays(start, 6)), days: 7 };
  }
  if (mode === "monthly") {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    return { start: dateKey(start), end: dateKey(end), days: end.getDate() };
  }
  const year = cursor.getFullYear();
  const days = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  return { start: `${year}-01-01`, end: `${year}-12-31`, days };
}

function periodLabel(mode: ViewMode, cursor: Date) {
  if (mode === "daily") {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(cursor);
  }
  if (mode === "weekly") {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    const startLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(start);
    const endLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(end);
    return `${startLabel} - ${endLabel}`;
  }
  if (mode === "monthly") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(cursor);
  }
  return String(cursor.getFullYear());
}

function shiftPeriod(mode: ViewMode, cursor: Date, direction: number) {
  if (mode === "daily") return addDays(cursor, direction);
  if (mode === "weekly") return addDays(cursor, direction * 7);
  if (mode === "monthly") {
    return new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
  }
  return new Date(cursor.getFullYear() + direction, cursor.getMonth(), 1);
}

export default function CalendarView({ year, month }: { year: number; month: number }) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<ViewMode>("monthly");
  const [cursor, setCursor] = useState(() => new Date(year, month, 1));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadTransactions() {
      setLoading(true);
      try {
        const data = await fetchTransactions();
        if (!cancelled) setTransactions(data);
      } catch (error) {
        if (!cancelled) {
          showToast(
            error instanceof Error ? error.message : "Failed to load calendar",
            { kind: "error", title: "Calendar unavailable" },
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const expenses = useMemo(
    () => transactions.filter((transaction) => transaction.type === "expense"),
    [transactions],
  );
  const bounds = useMemo(() => periodBounds(mode, cursor), [cursor, mode]);
  const periodExpenses = useMemo(
    () =>
      expenses
        .filter((transaction) => {
          const day = toCalendarDate(transaction.date);
          return day >= bounds.start && day <= bounds.end;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [bounds.end, bounds.start, expenses],
  );
  const total = periodExpenses.reduce((sum, transaction) => sum + transaction.amount, 0);
  const average = total / bounds.days;
  const categories = categoryBreakdown(periodExpenses);
  const amountByDay = useMemo(() => {
    return periodExpenses.reduce<Record<string, number>>((result, transaction) => {
      const day = toCalendarDate(transaction.date);
      result[day] = (result[day] ?? 0) + transaction.amount;
      return result;
    }, {});
  }, [periodExpenses]);

  function openDay(day: Date) {
    setCursor(day);
    setMode("daily");
  }

  function openMonth(monthIndex: number) {
    setCursor(new Date(cursor.getFullYear(), monthIndex, 1));
    setMode("monthly");
  }

  function selectMode(nextMode: ViewMode) {
    if (nextMode === "daily") {
      setCursor(new Date());
    }
    setMode(nextMode);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-brand/10 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-brand/10 p-4 sm:p-6 dark:border-zinc-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              Spending calendar
            </p>
            <h2 className="mt-1 text-xl font-semibold text-brand dark:text-white">
              Cost over time
            </h2>
          </div>
          <div className="grid grid-cols-4 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectMode(item.id)}
                className={`min-w-0 rounded-md px-3 py-2 text-sm font-medium transition sm:min-w-20 ${
                  mode === item.id
                    ? "bg-white text-brand shadow-sm dark:bg-zinc-700 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCursor((current) => shiftPeriod(mode, current, -1))}
            className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-brand dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label={`Previous ${mode.replace("ly", "")}`}
          >
            <ChevronLeft />
          </button>
          <div className="flex min-w-0 items-center gap-2 text-center text-sm font-semibold text-zinc-900 dark:text-white sm:text-base">
            <CalendarIcon className="hidden text-gold sm:block" />
            <span>{periodLabel(mode, cursor)}</span>
          </div>
          <button
            type="button"
            onClick={() => setCursor((current) => shiftPeriod(mode, current, 1))}
            className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-brand dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label={`Next ${mode.replace("ly", "")}`}
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="grid border-b border-brand/10 sm:grid-cols-3 dark:border-zinc-800">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium uppercase text-zinc-500">Total cost</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
            {loading ? "--" : formatCurrency(total)}
          </p>
        </div>
        <div className="border-y border-brand/10 p-4 sm:border-x sm:border-y-0 sm:p-5 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase text-zinc-500">Daily average</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-brand dark:text-white">
            {loading ? "--" : formatCurrency(average)}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium uppercase text-zinc-500">Transactions</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-brand dark:text-white">
            {loading ? "--" : periodExpenses.length}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="grid min-h-72 place-items-center text-sm text-zinc-500">
            Loading calendar...
          </div>
        ) : (
          <>
            {mode === "weekly" && (
              <WeekGrid cursor={cursor} amountByDay={amountByDay} onSelect={openDay} />
            )}
            {mode === "monthly" && (
              <MonthGrid cursor={cursor} amountByDay={amountByDay} onSelect={openDay} />
            )}
            {mode === "yearly" && (
              <YearGrid year={cursor.getFullYear()} expenses={periodExpenses} onSelect={openMonth} />
            )}
            {mode === "daily" && <CategoryBars categories={categories} />}

            <div className="mt-7 border-t border-brand/10 pt-5 dark:border-zinc-800">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Expense details
                </h3>
                {periodExpenses.length > 8 && (
                  <span className="text-xs text-zinc-500">Latest 8</span>
                )}
              </div>
              {periodExpenses.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
                  No expenses in this period.
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {periodExpenses.slice(0, 8).map((transaction) => (
                    <li key={transaction.id} className="flex items-center gap-3 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-base dark:bg-rose-950/40">
                        {transaction.categoryIcon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                          {transaction.description || transaction.category}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {transaction.category} - {toCalendarDate(transaction.date)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                        {formatCurrency(transaction.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function WeekGrid({
  cursor,
  amountByDay,
  onSelect,
}: {
  cursor: Date;
  amountByDay: Record<string, number>;
  onSelect: (day: Date) => void;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const max = Math.max(...days.map((day) => amountByDay[dateKey(day)] ?? 0), 1);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((day, index) => {
        const amount = amountByDay[dateKey(day)] ?? 0;
        return (
          <button
            key={dateKey(day)}
            type="button"
            onClick={() => onSelect(day)}
            className="min-h-28 rounded-lg border border-zinc-200 p-3 text-left transition hover:border-brand/30 hover:bg-brand/5 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <span className="text-xs font-medium text-zinc-500">{WEEKDAYS[index]}</span>
            <span className="mt-1 block text-lg font-semibold text-zinc-900 dark:text-white">
              {day.getDate()}
            </span>
            <span className="mt-3 block truncate text-xs font-medium tabular-nums text-rose-600 dark:text-rose-400">
              {formatCurrency(amount)}
            </span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
              <span
                className="block h-full rounded-full bg-rose-500"
                style={{ width: `${(amount / max) * 100}%` }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MonthGrid({
  cursor,
  amountByDay,
  onSelect,
}: {
  cursor: Date;
  amountByDay: Record<string, number>;
  onSelect: (day: Date) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: count }, (_, index) => new Date(year, month, index + 1)),
  ];
  while (cells.length % 7) cells.push(null);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[42rem]">
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-700">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 pb-2 text-center text-xs font-medium text-zinc-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, index) =>
            day ? (
              <button
                key={dateKey(day)}
                type="button"
                onClick={() => onSelect(day)}
                className="min-h-24 border-b border-r border-zinc-100 p-2 text-left transition hover:bg-brand/5 dark:border-zinc-800 dark:hover:bg-zinc-800"
              >
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {day.getDate()}
                </span>
                {(amountByDay[dateKey(day)] ?? 0) > 0 && (
                  <span className="mt-4 block truncate text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {formatCurrency(amountByDay[dateKey(day)])}
                  </span>
                )}
              </button>
            ) : (
              <div key={`empty-${index}`} className="min-h-24 border-b border-r border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/30" />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function YearGrid({
  year,
  expenses,
  onSelect,
}: {
  year: number;
  expenses: Transaction[];
  onSelect: (month: number) => void;
}) {
  const totals = Array.from({ length: 12 }, (_, month) =>
    expenses
      .filter((transaction) => Number(toCalendarDate(transaction.date).slice(5, 7)) - 1 === month)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );
  const max = Math.max(...totals, 1);
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {totals.map((amount, month) => (
        <button
          key={month}
          type="button"
          onClick={() => onSelect(month)}
          className="rounded-lg border border-zinc-200 p-4 text-left transition hover:border-brand/30 hover:bg-brand/5 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            {new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(year, month, 1))}
          </span>
          <span className="mt-2 block text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">
            {formatCurrency(amount)}
          </span>
          <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
            <span className="block h-full rounded-full bg-rose-500" style={{ width: `${(amount / max) * 100}%` }} />
          </span>
        </button>
      ))}
    </div>
  );
}

function CategoryBars({ categories }: { categories: ReturnType<typeof categoryBreakdown> }) {
  if (!categories.length) return null;
  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <div key={category.category}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
              {category.icon} {category.category}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-white">
              {formatCurrency(category.amount)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-rose-500" style={{ width: `${category.percentage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
