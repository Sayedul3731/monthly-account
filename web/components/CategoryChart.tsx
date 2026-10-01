"use client";

import {
  categoryBreakdown,
  formatCurrency,
  type Transaction,
} from "@/lib/finance";

const CATEGORY_COLORS = [
  { fill: "#e85d75", bar: "bg-rose-500" },
  { fill: "#c9a35c", bar: "bg-gold" },
  { fill: "#123847", bar: "bg-brand" },
  { fill: "#0d9488", bar: "bg-teal-600" },
  { fill: "#0284c7", bar: "bg-sky-600" },
  { fill: "#7c3aed", bar: "bg-violet-600" },
  { fill: "#f59e0b", bar: "bg-amber-500" },
  { fill: "#78716c", bar: "bg-stone-500" },
];

const CATEGORY_LABELS: Record<string, string> = {
  Bills: "Bills",
  Entertainment: "Entertainment",
  Food: "Food",
  Health: "Health",
  Installment: "Installment",
  Other: "Other",
  Shopping: "Shopping",
  Transport: "Transport",
};

type Props = {
  transactions: Transaction[];
};

export default function CategoryChart({ transactions }: Props) {
  const expenses = categoryBreakdown(transactions, "expense");
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const donutStops = expenses.map((item, index) => {
    const start = expenses
      .slice(0, index)
      .reduce((sum, previous) => sum + previous.percentage, 0);
    const end = start + item.percentage;
    const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length].fill;
    return `${color} ${start}% ${end}%`;
  });

  if (expenses.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-xl dark:bg-rose-950/40">
          📊
        </div>
        <p className="font-medium text-zinc-700 dark:text-zinc-200">
          এখনো কোনো খরচ নেই
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          খরচ যোগ করলে ক্যাটাগরি অনুযায়ী হিসাব এখানে দেখা যাবে।
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
      <div
        className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(${donutStops.join(", ")})` }}
        role="img"
        aria-label={`মোট খরচ ${formatCurrency(total)}`}
      >
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner dark:bg-zinc-900">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            মোট খরচ
          </span>
          <strong className="mt-0.5 text-base font-bold tabular-nums text-brand dark:text-white">
            {formatCurrency(total)}
          </strong>
        </div>
      </div>

      <ul className="space-y-3">
        {expenses.map((item, index) => {
          const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          return (
            <li key={item.category}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-zinc-700 dark:text-zinc-200">
                  <span className="mr-2" aria-hidden="true">{item.icon}</span>
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  {formatCurrency(item.amount)}
                  <span className="ml-1.5 text-xs font-medium text-zinc-400">
                    {item.percentage.toFixed(0)}%
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${color.bar}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
