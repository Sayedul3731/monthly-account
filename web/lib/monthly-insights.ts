import {
  categoryBreakdown,
  formatCurrency,
  type Transaction,
} from "./finance";

export type MonthlyInsight = {
  icon: "💡" | "🎯";
  message: string;
};

type MonthlyInsightInput = {
  transactions: Transaction[];
  previousTransactions?: Transaction[];
  budgetRemaining?: number | null;
  budgetUsedPercent?: number | null;
};

/** Returns the single most useful, data-backed message for the monthly overview. */
export function getMonthlyInsight({
  transactions,
  previousTransactions = [],
  budgetRemaining = null,
  budgetUsedPercent = null,
}: MonthlyInsightInput): MonthlyInsight | null {
  const currentExpenses = categoryBreakdown(transactions);
  const previousExpenses = categoryBreakdown(previousTransactions);

  if (budgetRemaining !== null && budgetRemaining < 0) {
    return {
      icon: "🎯",
      message: `আপনার মাসিক বাজেটের চেয়ে ${formatCurrency(
        Math.abs(budgetRemaining),
      )} বেশি খরচ হয়েছে।`,
    };
  }

  if (
    budgetRemaining !== null &&
    budgetRemaining > 0 &&
    budgetUsedPercent !== null &&
    budgetUsedPercent >= 80
  ) {
    return {
      icon: "🎯",
      message: `আর ${formatCurrency(budgetRemaining)}-এর মধ্যে থাকলে আপনি বাজেটের মধ্যে থাকবেন।`,
    };
  }

  const previousAmounts = new Map(
    previousExpenses.map(({ category, amount }) => [category, amount]),
  );
  const largestIncrease = currentExpenses
    .map(({ category, amount }) => ({
      category,
      increase: amount - (previousAmounts.get(category) ?? 0),
    }))
    .filter(({ increase }) => increase >= 100)
    .sort((a, b) => b.increase - a.increase)[0];

  if (largestIncrease && previousTransactions.length > 0) {
    return {
      icon: "💡",
      message: `এই মাসে আপনার ${largestIncrease.category} খরচ গত মাসের চেয়ে ${formatCurrency(
        largestIncrease.increase,
      )} বেশি।`,
    };
  }

  const largestExpense = currentExpenses[0];
  if (largestExpense) {
    return {
      icon: "💡",
      message: `আপনার সবচেয়ে বড় খরচ হলো ${largestExpense.category} (${formatCurrency(
        largestExpense.amount,
      )})।`,
    };
  }

  return null;
}
