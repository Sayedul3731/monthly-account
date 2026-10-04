"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createRecurringExpense,
  deleteRecurringExpense,
  fetchCategories,
  fetchRecurringExpenses,
  updateRecurringExpense,
  type ApiCategory,
  type RecurringExpense,
} from "@/lib/api";
import { formatCurrency } from "@/lib/finance";
import CategoryCreator from "./CategoryCreator";

type Props = {
  onChanged: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

const fieldClass =
  "w-full rounded-xl border border-brand/10 bg-paper/60 px-3 py-2.5 text-zinc-900 outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:bg-zinc-800";

export default function RecurringExpensesPanel({
  onChanged,
  onError,
  onSuccess,
}: Props) {
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [saving, setSaving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [loading, setLoading] = useState(true);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextItems, nextCategories] = await Promise.all([
          fetchRecurringExpenses(),
          fetchCategories("expense"),
        ]);
        if (cancelled) return;
        setItems(nextItems);
        setCategories(nextCategories);
        setCategoryId((current) => current || nextCategories[0]?.id || "");
      } catch (err) {
        if (cancelled) return;
        onError(
          err instanceof Error
            ? err.message
            : "Could not load recurring expenses.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [onError]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (creatingCategory) return;
    const parsedAmount = Number(amount);
    const parsedDay = Number(dayOfMonth);
    if (!categoryId || !Number.isFinite(parsedAmount) || parsedAmount <= 0)
      return;
    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) return;

    setSaving(true);
    try {
      const created = await createRecurringExpense({
        categoryId,
        amount: parsedAmount,
        description: description.trim() || null,
        dayOfMonth: parsedDay,
      });
      setItems((previous) => [created, ...previous]);
      setAmount("");
      setDescription("");
      onSuccess(
        "Recurring expense saved. It will be added automatically each month.",
      );
      onChanged();
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Could not save recurring expense.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: RecurringExpense) {
    try {
      const updated = await updateRecurringExpense(item.id, {
        active: !item.active,
      });
      setItems((previous) =>
        previous.map((entry) => (entry.id === item.id ? updated : entry)),
      );
      onSuccess(
        updated.active
          ? "Recurring expense resumed."
          : "Recurring expense paused.",
      );
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Could not update recurring expense.",
      );
    }
  }

  async function remove(item: RecurringExpense) {
    if (
      !window.confirm(
        `Remove the recurring expense “${item.description || item.category?.name || "Expense"}”?`,
      )
    )
      return;
    try {
      await deleteRecurringExpense(item.id);
      setItems((previous) => previous.filter((entry) => entry.id !== item.id));
      onSuccess("Recurring expense removed. Existing transactions were kept.");
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Could not remove recurring expense.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-brand/10 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
          Set once, post monthly
        </p>
        <h2 className="mt-1 text-lg font-semibold text-brand dark:text-white">
          Recurring expenses
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Rent, subscriptions, and bills are added automatically when you open a
          month.
        </p>

        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Amount
            <input
              className={`${fieldClass} mt-1.5`}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="15000"
              required
            />
          </label>
          <div>
            <label
              htmlFor="recurring-category"
              className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
            >
              Category
            </label>
            <select
              id="recurring-category"
              className={`${fieldClass} mt-1.5`}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
            >
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon ? `${category.icon} ` : ""}
                  {category.name}
                </option>
              ))}
            </select>
            <CategoryCreator
              type="expense"
              disabled={loading || saving}
              onBusyChange={setCreatingCategory}
              onCreated={(category) => {
                setCategories((previous) =>
                  [...previous, category].sort((a, b) =>
                    a.name.localeCompare(b.name),
                  ),
                );
                setCategoryId(category.id);
              }}
            />
          </div>
          <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Description
            <input
              className={`${fieldClass} mt-1.5`}
              value={description}
              maxLength={255}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. Home rent"
            />
          </label>
          <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Day of month
            <input
              className={`${fieldClass} mt-1.5`}
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(event) => setDayOfMonth(event.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            disabled={saving || creatingCategory || loading || !categoryId}
            className="sm:col-span-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-rose-500/20 transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add recurring expense"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-brand/10 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-base font-semibold text-brand dark:text-white">
          Your schedules
        </h3>
        {loading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading schedules...</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No recurring expenses yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-brand/5 dark:divide-zinc-800">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-lg dark:bg-rose-950/40">
                  {item.category?.icon || "📌"}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-semibold ${item.active ? "text-zinc-900 dark:text-white" : "text-zinc-400 line-through"}`}
                  >
                    {item.description ||
                      item.category?.name ||
                      "Recurring expense"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatCurrency(item.amount)} · day {item.dayOfMonth} ·{" "}
                    {item.active ? "Active" : "Paused"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void toggle(item)}
                    className="rounded-lg border border-brand/10 px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/5 dark:border-zinc-700 dark:text-zinc-200"
                  >
                    {item.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
