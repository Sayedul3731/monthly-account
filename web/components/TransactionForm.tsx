"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createTransaction,
  fetchCategories,
  fetchTransactionTypes,
  updateTransaction,
  type ApiCategory,
  type ApiTransactionType,
} from "@/lib/api";
import {
  calendarYearMonth,
  monthDateBounds,
  toCalendarDate,
  toDateInputValue,
  type Transaction,
  type TransactionType,
} from "@/lib/finance";
import { CloseIcon, TrendDownIcon, TrendUpIcon } from "./icons";

type FormMode = "create" | "edit";

type Props = {
  year: number;
  month: number;
  editing: Transaction | null;
  onSaved: (
    transaction: Transaction,
    navigatedMonth?: { year: number; month: number },
  ) => void;
  onCancelEdit: () => void;
  onError: (message: string) => void;
};

const fieldClass =
  "w-full rounded-xl border border-brand/10 bg-paper/60 px-4 py-3 text-zinc-900 outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:bg-zinc-800";

export default function TransactionForm({
  year,
  month,
  editing,
  onSaved,
  onCancelEdit,
  onError,
}: Props) {
  const mode: FormMode = editing ? "edit" : "create";
  const bounds = monthDateBounds(year, month);
  const defaultDate =
    mode === "edit" && editing
      ? toCalendarDate(editing.date)
      : bounds.max >= toDateInputValue(new Date()) &&
          bounds.min <= toDateInputValue(new Date())
        ? toDateInputValue(new Date())
        : bounds.max;

  const [type, setType] = useState<TransactionType>(
    editing?.type ?? "expense",
  );
  const [amount, setAmount] = useState(
    editing ? String(editing.amount) : "",
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [date, setDate] = useState(defaultDate);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<
    ApiTransactionType[]
  >([]);
  const [lookupsReady, setLookupsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchCategories(), fetchTransactionTypes()])
      .then(([nextCategories, nextTypes]) => {
        if (cancelled) return;
        setCategories(nextCategories);
        setTransactionTypes(nextTypes);

        if (!editing) {
          const firstExpense = nextCategories.find(
            (category) => category.type === "expense",
          );
          if (firstExpense) setCategoryId(firstExpense.id);
        }
        setLookupsReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        onError(
          err instanceof Error
            ? err.message
            : "Failed to load categories",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [editing, onError]);

  const categoriesForType = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  function handleTypeChange(next: TransactionType) {
    setType(next);
    const first = categories.find((category) => category.type === next);
    setCategoryId(first?.id ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0 || !description.trim()) return;

    const transactionType = transactionTypes.find(
      (entry) => entry.name === type,
    );
    if (!transactionType || !categoryId) {
      onError("Categories are still loading. Try again in a moment.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        transactionTypeId: transactionType.id,
        categoryId,
        amount: parsed,
        description: description.trim(),
        date,
      };

      const entry =
        mode === "edit" && editing
          ? await updateTransaction(editing.id, payload)
          : await createTransaction(payload);

      const { year: txYear, month: txMonth } = calendarYearMonth(entry.date);

      if (mode === "create") {
        setAmount("");
        setDescription("");
        setDate(
          bounds.max >= toDateInputValue(new Date()) &&
            bounds.min <= toDateInputValue(new Date())
            ? toDateInputValue(new Date())
            : bounds.max,
        );
      }

      onSaved(
        entry,
        txYear !== year || txMonth !== month
          ? { year: txYear, month: txMonth }
          : undefined,
      );
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Failed to save transaction",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-zinc-900 ${
        mode === "edit"
          ? "border-gold/40 dark:border-gold/30"
          : "border-brand/10 dark:border-zinc-800"
      }`}
    >
      {mode === "edit" && (
        <div className="flex items-center justify-between gap-3 border-b border-gold/20 bg-gold/10 px-5 py-2.5">
          <p className="truncate text-sm font-medium text-brand dark:text-gold">
            Editing {editing?.description}
          </p>
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-lg p-1 text-brand/60 transition hover:bg-white/70 hover:text-brand dark:text-gold/70 dark:hover:bg-zinc-800 dark:hover:text-gold"
            aria-label="Cancel edit"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              Ledger entry
            </p>
            <h2 className="mt-1 text-base font-semibold text-brand dark:text-white">
              {mode === "edit" ? "Update transaction" : "Post a transaction"}
            </h2>
          </div>
          {mode === "create" && (
            <span className="mt-1 rounded-full border border-brand/10 bg-brand/5 px-2.5 py-0.5 text-[11px] font-medium text-brand/70 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              New
            </span>
          )}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-brand/5 p-1 dark:bg-zinc-800">
          {(["expense", "income"] as const).map((option) => {
            const active = type === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleTypeChange(option)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold capitalize transition ${
                  active
                    ? option === "income"
                      ? "bg-white text-brand shadow-sm dark:bg-zinc-900 dark:text-gold"
                      : "bg-white text-rose-600 shadow-sm dark:bg-zinc-900 dark:text-rose-400"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                {option === "income" ? <TrendUpIcon /> : <TrendDownIcon />}
                {option}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="amount"
                className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >
                Amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-brand/50 dark:text-zinc-400">
                  $
                </span>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`${fieldClass} pl-8 text-lg font-semibold tabular-nums`}
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="date"
                className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >
                Date
              </label>
              <input
                id="date"
                type="date"
                value={date}
                min={bounds.min}
                max={bounds.max}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="category"
                className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >
                Category
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={fieldClass}
                required
                disabled={!lookupsReady}
              >
                {categoriesForType.length === 0 ? (
                  <option value="">
                    {lookupsReady ? "No categories" : "Loading..."}
                  </option>
                ) : (
                  categoriesForType.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon ? `${category.icon} ` : ""}
                      {category.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >
                Description
              </label>
              <input
                id="description"
                type="text"
                placeholder="e.g. Grocery run, paycheck..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={fieldClass}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !lookupsReady || !categoryId}
            className={`w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
              type === "income"
                ? "bg-brand shadow-brand/20 hover:bg-brand-deep"
                : "bg-rose-500 shadow-rose-500/20 hover:bg-rose-600"
            }`}
          >
            {submitting
              ? "Saving..."
              : mode === "edit"
                ? "Save changes"
                : `Add ${type}`}
          </button>
        </form>
      </div>
    </section>
  );
}
