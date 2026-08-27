"use client";

import {
  categoryBreakdown,
  formatCurrency,
  type Transaction,
} from "@/lib/finance";

const BAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

type Props = {
  transactions: Transaction[];
};

export default function CategoryChart({ transactions }: Props) {
  const expenses = categoryBreakdown(transactions, "expense");
  const income = categoryBreakdown(transactions, "income");

  if (expenses.length === 0 && income.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Add transactions to see category breakdown.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <BreakdownPanel title="Expenses by category" items={expenses} />
      <BreakdownPanel title="Income by category" items={income} tone="income" />
    </div>
  );
}

function BreakdownPanel({
  title,
  items,
  tone = "expense",
}: {
  title: string;
  items: ReturnType<typeof categoryBreakdown>;
  tone?: "expense" | "income";
}) {
  if (items.length === 0) {
    return (
      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {title}
        </h3>
        <p className="text-sm text-zinc-500">No data yet.</p>
      </div>
    );
  }

  const max = items[0]?.amount ?? 1;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={item.category}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                <span>{item.icon}</span>
                {item.category}
              </span>
              <span
                className={`font-medium tabular-nums ${
                  tone === "income"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatCurrency(item.amount)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${BAR_COLORS[i % BAR_COLORS.length]}`}
                style={{ width: `${(item.amount / max) * 100}%` }}
              />
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              {item.percentage.toFixed(0)}% of total
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
