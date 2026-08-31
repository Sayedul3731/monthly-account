"use client";

import { useMemo, useState } from "react";
import { deleteBudget, upsertBudget, type Budget } from "@/lib/api";
import {
  EXPENSE_CATEGORIES,
  CATEGORY_ICONS,
  formatCurrency,
  type Transaction,
} from "@/lib/finance";
import { TrashIcon } from "./icons";

type Props = {
  year: number;
  month: number;
  budgets: Budget[];
  transactions: Transaction[];
  onBudgetsChange: (budgets: Budget[]) => void;
  onError: (message: string) => void;
};

export default function BudgetPanel({
  year,
  month,
  budgets,
  transactions,
  onBudgetsChange,
  onError,
}: Props) {
  const [overallAmount, setOverallAmount] = useState("");
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const overallBudget = budgets.find((b) => !b.category);
  const categoryBudgets = budgets.filter((b) => b.category);

  const expenseTotal = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  const spendingByCategory = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense")
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] ?? 0) + t.amount;
        return acc;
      }, {});
  }, [transactions]);

  async function saveBudget(category: string | null, amountStr: string) {
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) return;

    const key = category ?? "__overall__";
    setSaving(key);

    try {
      const saved = await upsertBudget({
        year,
        month,
        category: category ?? "",
        amount,
      });
      onBudgetsChange([
        ...budgets.filter((b) =>
          category ? b.category !== category : !!b.category,
        ),
        saved,
      ]);
      if (category === null) setOverallAmount("");
      else setCategoryAmounts((prev) => ({ ...prev, [category]: "" }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save budget");
    } finally {
      setSaving(null);
    }
  }

  async function removeBudget(id: string) {
    try {
      await deleteBudget(id);
      onBudgetsChange(budgets.filter((b) => b.id !== id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete budget");
    }
  }

  const overallProgress =
    overallBudget && overallBudget.amount > 0
      ? Math.min((expenseTotal / overallBudget.amount) * 100, 100)
      : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-white">
          Monthly budget
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Set a spending limit for the month and track progress.
        </p>

        {overallBudget ? (
          <div className="mb-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Overall limit
              </span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {formatCurrency(overallBudget.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => removeBudget(overallBudget.id)}
                  className="rounded p-1 text-zinc-400 hover:text-rose-600"
                  aria-label="Remove overall budget"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
            <div className="mb-1 flex justify-between text-xs text-zinc-500">
              <span>Spent {formatCurrency(expenseTotal)}</span>
              <span>{overallProgress.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className={`h-full rounded-full transition-all ${
                  overallProgress >= 100 ? "bg-rose-500" : "bg-brand"
                }`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            {overallProgress >= 100 && (
              <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                Budget exceeded by {formatCurrency(expenseTotal - overallBudget.amount)}
              </p>
            )}
          </div>
        ) : (
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveBudget(null, overallAmount);
            }}
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                ৳
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Overall budget"
                value={overallAmount}
                onChange={(e) => setOverallAmount(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-8 pr-4 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={saving === "__overall__"}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              Set
            </button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-white">
          Category budgets
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Set limits per expense category.
        </p>

        <ul className="space-y-3">
          {EXPENSE_CATEGORIES.map((cat) => {
            const budget = categoryBudgets.find((b) => b.category === cat);
            const spent = spendingByCategory[cat] ?? 0;
            const progress =
              budget && budget.amount > 0
                ? Math.min((spent / budget.amount) * 100, 100)
                : 0;

            return (
              <li
                key={cat}
                className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {CATEGORY_ICONS[cat]} {cat}
                  </span>
                  {budget ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-500">
                        {formatCurrency(spent)} / {formatCurrency(budget.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBudget(budget.id)}
                        className="rounded p-1 text-zinc-400 hover:text-rose-600"
                        aria-label={`Remove ${cat} budget`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ) : null}
                </div>

                {budget ? (
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        progress >= 100 ? "bg-rose-500" : "bg-gold"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveBudget(cat, categoryAmounts[cat] ?? "");
                    }}
                  >
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                        ৳
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Budget limit"
                        value={categoryAmounts[cat] ?? ""}
                        onChange={(e) =>
                          setCategoryAmounts((prev) => ({
                            ...prev,
                            [cat]: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-7 pr-3 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving === cat}
                      className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Set
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
