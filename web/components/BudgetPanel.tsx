"use client";

import { useMemo, useState } from "react";
import { deleteBudget, upsertBudget, type Budget } from "@/lib/api";
import {
  EXPENSE_CATEGORIES,
  CATEGORY_ICONS,
  formatCurrency,
  type Transaction,
} from "@/lib/finance";
import { EditIcon, MoreHorizontalIcon, TrashIcon } from "./icons";

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
  const [categoryAmounts, setCategoryAmounts] = useState<
    Record<string, string>
  >({});
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const overallBudget = budgets.find((b) => !b.category);
  const categoryBudgets = budgets.filter((b) => b.category);
  const totalCategoryBudget = categoryBudgets.reduce(
    (total, budget) => total + budget.amount,
    0,
  );

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
    if (!Number.isFinite(amount) || amount <= 0) {
      onError("Enter a budget greater than zero.");
      return;
    }

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
      setEditing(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save budget");
    } finally {
      setSaving(null);
    }
  }

  function startEditing(category: string | null, amount: number) {
    const key = category ?? "__overall__";
    setOpenMenu(null);
    setEditing(key);

    if (category === null) setOverallAmount(String(amount));
    else setCategoryAmounts((prev) => ({ ...prev, [category]: String(amount) }));
  }

  function cancelEditing(category: string | null) {
    setEditing(null);
    if (category === null) setOverallAmount("");
    else setCategoryAmounts((prev) => ({ ...prev, [category]: "" }));
  }

  async function removeBudget(id: string) {
    setOpenMenu(null);
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
  const allocationDifference = overallBudget
    ? overallBudget.amount - totalCategoryBudget
    : null;

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
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums text-zinc-900 dark:text-white">
                  {formatCurrency(overallBudget.amount)}
                </span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenu((current) =>
                        current === overallBudget.id ? null : overallBudget.id,
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                    aria-label="Budget actions"
                    aria-haspopup="menu"
                    aria-expanded={openMenu === overallBudget.id}
                    title="Budget actions"
                  >
                    <MoreHorizontalIcon />
                  </button>
                  {openMenu === overallBudget.id && (
                    <div
                      role="menu"
                      className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => startEditing(null, overallBudget.amount)}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-zinc-700 transition hover:bg-brand/5 hover:text-brand dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-gold"
                      >
                        <EditIcon />
                        Edit
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => removeBudget(overallBudget.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
                      >
                        <TrashIcon />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {editing === "__overall__" ? (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveBudget(null, overallAmount);
                }}
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={overallAmount}
                  onChange={(event) => setOverallAmount(event.target.value)}
                  aria-label="Overall budget"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={saving === "__overall__"}
                  className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => cancelEditing(null)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
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
                    Budget exceeded by {formatCurrency(
                      expenseTotal - overallBudget.amount,
                    )}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveBudget(null, overallAmount);
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
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-white">
              Category budgets
            </h2>
            <p className="text-sm text-zinc-500">
              Allocate your monthly budget across expense categories.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-brand/10 bg-brand/5 px-3 py-2 text-right dark:border-zinc-700 dark:bg-zinc-800">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Allocated
            </p>
            <p className="text-sm font-bold tabular-nums text-brand dark:text-gold">
              {formatCurrency(totalCategoryBudget)}
              {overallBudget && (
                <span className="font-medium text-zinc-400 dark:text-zinc-500">
                  {` / ${formatCurrency(overallBudget.amount)}`}
                </span>
              )}
            </p>
          </div>
        </div>

        {allocationDifference === null ? (
          <p className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
            Set an overall monthly budget to track how much is available to
            allocate.
          </p>
        ) : allocationDifference < 0 ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          >
            Category allocations exceed your monthly budget by{" "}
            {formatCurrency(Math.abs(allocationDifference))}.
          </p>
        ) : (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {formatCurrency(allocationDifference)} remains available to
            allocate.
          </p>
        )}

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
                    <div className="flex items-center gap-3 text-sm">
                      <span className="tabular-nums text-zinc-500">
                        {formatCurrency(spent)} / {formatCurrency(budget.amount)}
                      </span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenu((current) =>
                              current === budget.id ? null : budget.id,
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                          aria-label={`${cat} budget actions`}
                          aria-haspopup="menu"
                          aria-expanded={openMenu === budget.id}
                          title={`${cat} budget actions`}
                        >
                          <MoreHorizontalIcon />
                        </button>
                        {openMenu === budget.id && (
                          <div
                            role="menu"
                            className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => startEditing(cat, budget.amount)}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-zinc-700 transition hover:bg-brand/5 hover:text-brand dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-gold"
                            >
                              <EditIcon />
                              Edit
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => removeBudget(budget.id)}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
                            >
                              <TrashIcon />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {budget && editing === cat ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveBudget(cat, categoryAmounts[cat] ?? "");
                    }}
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={categoryAmounts[cat] ?? ""}
                      onChange={(event) =>
                        setCategoryAmounts((prev) => ({
                          ...prev,
                          [cat]: event.target.value,
                        }))
                      }
                      aria-label={`${cat} budget`}
                      className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={saving === cat}
                      className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelEditing(cat)}
                      className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </form>
                ) : budget ? (
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
                      void saveBudget(cat, categoryAmounts[cat] ?? "");
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
