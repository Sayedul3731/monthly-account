export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  categoryId: string;
  transactionTypeId: string;
  categoryIcon: string;
  date: string;
};

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Gift",
  "Other",
] as const;

export const EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Bills",
  "Shopping",
  "Health",
  "Entertainment",
  "Other",
] as const;

export const CATEGORY_ICONS: Record<string, string> = {
  Salary: "💼",
  Freelance: "🖥️",
  Investment: "📈",
  Gift: "🎁",
  Food: "🍽️",
  Transport: "🚗",
  Bills: "📄",
  Shopping: "🛍️",
  Health: "💊",
  Entertainment: "🎬",
  Other: "📌",
};

export function formatCurrency(amount: number): string {
  const formattedAmount = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  return `৳${formattedAmount}`;
}

export function formatMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month));
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function isInMonth(date: string, year: number, month: number): boolean {
  const parsed = new Date(date);
  return parsed.getFullYear() === year && parsed.getMonth() === month;
}

export function summarize(transactions: Transaction[]) {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    income,
    expenses,
    balance: income - expenses,
    savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
  };
}

export type CategoryBreakdown = {
  category: string;
  amount: number;
  percentage: number;
  icon: string;
};

export function categoryBreakdown(
  transactions: Transaction[],
  type: TransactionType = "expense",
): CategoryBreakdown[] {
  const filtered = transactions.filter((t) => t.type === type);
  const total = filtered.reduce((sum, t) => sum + t.amount, 0);

  const byCategory = filtered.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});

  const icons = filtered.reduce<Record<string, string>>((acc, t) => {
    if (!acc[t.category]) {
      acc[t.category] = t.categoryIcon || CATEGORY_ICONS[t.category] || "📌";
    }
    return acc;
  }, {});

  return Object.entries(byCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      icon: icons[category] ?? "📌",
    }))
    .sort((a, b) => b.amount - a.amount);
}

export type SortField = "date" | "amount" | "description";
export type SortDirection = "asc" | "desc";

export function filterAndSortTransactions(
  transactions: Transaction[],
  options: {
    search?: string;
    type?: TransactionType | "all";
    category?: string | "all";
    sortField?: SortField;
    sortDirection?: SortDirection;
  },
): Transaction[] {
  let result = [...transactions];

  if (options.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    result = result.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }

  if (options.type && options.type !== "all") {
    result = result.filter((t) => t.type === options.type);
  }

  if (options.category && options.category !== "all") {
    result = result.filter((t) => t.category === options.category);
  }

  const field = options.sortField ?? "date";
  const direction = options.sortDirection ?? "desc";
  const multiplier = direction === "asc" ? 1 : -1;

  result.sort((a, b) => {
    if (field === "date") {
      return (
        multiplier *
        (new Date(a.date).getTime() - new Date(b.date).getTime())
      );
    }
    if (field === "amount") {
      return multiplier * (a.amount - b.amount);
    }
    return multiplier * a.description.localeCompare(b.description);
  });

  return result;
}

export function toCalendarDate(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return toDateInputValue(new Date(value));
}

export function calendarYearMonth(value: string): { year: number; month: number } {
  const day = toCalendarDate(value);
  return {
    year: Number(day.slice(0, 4)),
    month: Number(day.slice(5, 7)) - 1,
  };
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthDateBounds(year: number, month: number) {
  return {
    min: toDateInputValue(new Date(year, month, 1)),
    max: toDateInputValue(new Date(year, month + 1, 0)),
  };
}

export function createId(): string {
  return crypto.randomUUID();
}
