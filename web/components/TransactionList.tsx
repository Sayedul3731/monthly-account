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
import { EditIcon, SearchIcon, TrashIcon, WalletIcon } from "./icons";

type Props = {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
};

const TYPE_FILTERS: { id: TransactionType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expenses" },
];

function dayKey(date: string) {
  return date.slice(0, 10);
}

function formatDayHeading(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function formatRowDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

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

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, entry) => {
        if (entry.type === "income") acc.income += entry.amount;
        else acc.expenses += entry.amount;
        return acc;
      },
      { income: 0, expenses: 0 },
    );
  }, [filtered]);

  const grouped = useMemo(() => {
    if (sortField !== "date") return null;
    const groups: { date: string; items: Transaction[] }[] = [];
    for (const entry of filtered) {
      const key = dayKey(entry.date);
      const last = groups[groups.length - 1];
      if (last && last.date === key) last.items.push(entry);
      else groups.push({ date: key, items: [entry] });
    }
    return groups;
  }, [filtered, sortField]);

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

  const hasActiveFilters =
    search.trim() !== "" || typeFilter !== "all" || categoryFilter !== "all";

  return (
    <section className="overflow-hidden rounded-2xl border border-brand/10 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-brand/10 px-5 py-4 dark:border-zinc-800">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              Register
            </p>
            <h2 className="mt-1 text-base font-semibold text-brand dark:text-white">
              Transactions
            </h2>
          </div>
          <span className="rounded-full border border-brand/10 bg-brand/5 px-2.5 py-0.5 text-xs font-medium text-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {filtered.length}
            {filtered.length !== transactions.length
              ? ` / ${transactions.length}`
              : ""}
          </span>
        </div>

        {transactions.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-brand/10 bg-brand/5 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                In
              </p>
              <p className="text-sm font-semibold tabular-nums text-brand dark:text-gold">
                +{formatCurrency(totals.income)}
              </p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-2 dark:border-rose-900/40 dark:bg-rose-950/30">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Out
              </p>
              <p className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                -{formatCurrency(totals.expenses)}
              </p>
            </div>
          </div>
        )}

        <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-brand/5 p-1 dark:bg-zinc-800">
          {TYPE_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTypeFilter(id)}
              className={`rounded-lg py-2 text-xs font-semibold transition sm:text-sm ${
                typeFilter === id
                  ? "bg-white text-brand shadow-sm dark:bg-zinc-900 dark:text-gold"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand/40">
              <SearchIcon />
            </span>
            <input
              type="search"
              placeholder="Search description or category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-brand/10 bg-paper/60 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="col-span-2 rounded-xl border border-brand/10 bg-paper/60 px-3 py-2.5 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-white sm:col-span-1"
            >
              <option value="all">All categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="rounded-xl border border-brand/10 bg-paper/60 px-2.5 py-2.5 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="description">Name</option>
            </select>
            <select
              value={sortDirection}
              onChange={(e) =>
                setSortDirection(e.target.value as SortDirection)
              }
              className="rounded-xl border border-brand/10 bg-paper/60 px-2.5 py-2.5 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="desc">
                {sortField === "date"
                  ? "Newest"
                  : sortField === "amount"
                    ? "High to low"
                    : "Z to A"}
              </option>
              <option value="asc">
                {sortField === "date"
                  ? "Oldest"
                  : sortField === "amount"
                    ? "Low to high"
                    : "A to Z"}
              </option>
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/5 text-brand">
            <WalletIcon />
          </div>
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            {transactions.length === 0
              ? "No entries this month"
              : "No matching transactions"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {transactions.length === 0
              ? "Post an income or expense above to start the register."
              : "Try adjusting your search or filters."}
          </p>
          {hasActiveFilters && transactions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
                setCategoryFilter("all");
              }}
              className="mt-4 text-sm font-medium text-brand hover:text-brand-deep dark:text-gold"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : grouped ? (
        <ul>
          {grouped.map((group) => (
            <li key={group.date}>
              <div className="flex items-center justify-between border-y border-brand/10 bg-paper/70 px-5 py-1.5 dark:border-zinc-800 dark:bg-zinc-950/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand/70 dark:text-gold">
                  {formatDayHeading(group.date)}
                </p>
                <p className="text-xs tabular-nums text-zinc-400">
                  {group.items.length}
                  {group.items.length === 1 ? " entry" : " entries"}
                </p>
              </div>
              <ul className="divide-y divide-brand/5 dark:divide-zinc-800">
                {group.items.map((entry) => (
                  <TransactionRow
                    key={entry.id}
                    transaction={entry}
                    showDate={false}
                    onEdit={onEdit}
                    onDelete={removeTransaction}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-brand/5 dark:divide-zinc-800">
          {filtered.map((entry) => (
            <TransactionRow
              key={entry.id}
              transaction={entry}
              showDate
              onEdit={onEdit}
              onDelete={removeTransaction}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TransactionRow({
  transaction,
  showDate,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  showDate: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const isIncome = transaction.type === "income";

  return (
    <li className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-brand/5 dark:hover:bg-zinc-800/50">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
          isIncome
            ? "bg-brand/10 dark:bg-brand/20"
            : "bg-rose-50 dark:bg-rose-950/50"
        }`}
      >
        {transaction.categoryIcon || "📌"}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900 dark:text-white">
          {transaction.description}
        </p>
        <p className="text-sm text-zinc-500">
          {transaction.category}
          {showDate ? ` · ${formatRowDate(transaction.date)}` : ""}
        </p>
      </div>

      <p
        className={`shrink-0 font-semibold tabular-nums ${
          isIncome
            ? "text-brand dark:text-gold"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(transaction.amount)}
      </p>

      <div className="flex shrink-0 gap-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(transaction)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-brand/5 hover:text-brand dark:hover:bg-zinc-800 dark:hover:text-gold"
          aria-label={`Edit ${transaction.description}`}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          onClick={() => onDelete(transaction.id)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
          aria-label={`Delete ${transaction.description}`}
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}
