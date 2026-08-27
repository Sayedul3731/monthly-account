"use client";

import { useMemo, useState } from "react";
import { deleteTransaction } from "@/lib/api";
import {
  filterAndSortTransactions,
  formatCurrency,
  type SortDirection,
  type SortField,
  type Transaction,
  type TransactionType,
} from "@/lib/finance";
import { EditIcon, TrashIcon } from "./icons";

type Props = {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
};

export default function TransactionList({
  transactions,
  onEdit,
  onDeleted,
  onError,
}: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const allCategories = useMemo(
    () => [...new Set(transactions.map((transaction) => transaction.category))],
    [transactions],
  );

  const filtered = useMemo(
    () =>
      filterAndSortTransactions(transactions, {
        search,
        type: typeFilter,
        category: categoryFilter,
        sortField,
        sortDirection,
      }),
    [transactions, search, typeFilter, categoryFilter, sortField, sortDirection],
  );

  async function removeTransaction(id: string) {
    try {
      await deleteTransaction(id);
      onDeleted(id);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Failed to delete transaction",
      );
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
            Transactions
          </h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {filtered.length}
            {filtered.length !== transactions.length
              ? ` / ${transactions.length}`
              : ""}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="search"
            placeholder="Search description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:col-span-2"
          />
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as TransactionType | "all")
            }
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="all">All categories</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="date">Sort by date</option>
            <option value="amount">Sort by amount</option>
            <option value="description">Sort by name</option>
          </select>
          <select
            value={sortDirection}
            onChange={(e) =>
              setSortDirection(e.target.value as SortDirection)
            }
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-2xl dark:bg-zinc-800">
            📊
          </div>
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            {transactions.length === 0
              ? "No transactions yet"
              : "No matching transactions"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {transactions.length === 0
              ? "Add your first income or expense to start tracking."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {filtered.map((t) => (
            <li
              key={t.id}
              className="group flex items-center gap-4 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
                  t.type === "income"
                    ? "bg-emerald-50 dark:bg-emerald-950/50"
                    : "bg-rose-50 dark:bg-rose-950/50"
                }`}
              >
                {t.categoryIcon || "📌"}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-900 dark:text-white">
                  {t.description}
                </p>
                <p className="text-sm text-zinc-500">
                  {t.category} ·{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(t.date))}
                </p>
              </div>

              <p
                className={`shrink-0 font-semibold tabular-nums ${
                  t.type === "income"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {t.type === "income" ? "+" : "-"}
                {formatCurrency(t.amount)}
              </p>

              <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label={`Edit ${t.description}`}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  onClick={() => removeTransaction(t.id)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                  aria-label={`Delete ${t.description}`}
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
