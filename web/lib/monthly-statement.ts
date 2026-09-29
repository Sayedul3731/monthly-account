import type { Budget } from "./api";
import {
  categoryBreakdown,
  formatMonthLabel,
  getMonthKey,
  summarize,
  toCalendarDate,
  type Transaction,
} from "./finance";

type MonthlyStatementInput = {
  year: number;
  month: number;
  transactions: Transaction[];
  budgets: Budget[];
};

type TransactionWorkbookInput = {
  title: string;
  filename: string;
  transactions: Transaction[];
  budgets?: Budget[];
};

export type ExportRow = Record<
  string,
  string | number | boolean | null | undefined
>;

const currency = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "code",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function money(amount: number) {
  return currency.format(amount);
}

function sortedTransactions(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => a.date.localeCompare(b.date));
}

function categoryBudget(budgets: Budget[], category: string) {
  return budgets.find((budget) => budget.category === category)?.amount ?? null;
}

export function exportRowsCsv(rows: ExportRow[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: ExportRow[string]) => {
    const raw = value === null || value === undefined ? "" : String(value);
    const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

export async function downloadTableExcel({
  filename,
  sheetName,
  rows,
}: {
  filename: string;
  sheetName: string;
  rows: ExportRow[];
}) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.min(
      36,
      Math.max(
        12,
        header.length + 2,
        ...rows.map((row) => String(row[header] ?? "").length + 2),
      ),
    ),
  }));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFileXLSX(workbook, filename);
}

export async function downloadTransactionWorkbook({
  title,
  filename,
  transactions,
  budgets = [],
}: TransactionWorkbookInput) {
  const XLSX = await import("xlsx");
  const statement = XLSX.utils.book_new();
  const summary = summarize(transactions);
  const categories = categoryBreakdown(transactions);
  const overallBudget = budgets.find((budget) => !budget.category)?.amount ?? null;

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Monthly account statement"],
    ["Period", title],
    ["Generated", new Date().toLocaleString("en-BD")],
    [],
    ["Metric", "Amount (BDT)"],
    ["Income", summary.income],
    ["Expenses", summary.expenses],
    ["Net balance", summary.balance],
    ["Savings rate", summary.savingsRate / 100],
    ["Transactions", transactions.length],
    ["Overall budget", overallBudget ?? "Not set"],
    ["Budget remaining", overallBudget === null ? "Not set" : overallBudget - summary.expenses],
    [],
    ["Expense category", "Spent (BDT)", "Share", "Budget (BDT)", "Remaining (BDT)"],
    ...categories.map((category) => {
      const budget = categoryBudget(budgets, category.category);
      return [
        category.category,
        category.amount,
        category.percentage / 100,
        budget ?? "Not set",
        budget === null ? "Not set" : budget - category.amount,
      ];
    }),
  ]);
  summarySheet["!cols"] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
  ];
  if (summarySheet.B6) summarySheet.B6.z = '"BDT" #,##0.00';
  if (summarySheet.B7) summarySheet.B7.z = '"BDT" #,##0.00';
  if (summarySheet.B8) summarySheet.B8.z = '"BDT" #,##0.00';
  if (summarySheet.B9) summarySheet.B9.z = "0.0%";

  const transactionSheet = XLSX.utils.json_to_sheet(
    sortedTransactions(transactions).map((transaction) => ({
      Date: toCalendarDate(transaction.date),
      Type: transaction.type === "income" ? "Income" : "Expense",
      Category: transaction.category,
      Description: transaction.description ?? "",
      "Amount (BDT)": transaction.amount,
      "Sync status": transaction.pendingSync ? "Pending sync" : "Synced",
    })),
  );
  transactionSheet["!cols"] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 20 },
    { wch: 38 },
    { wch: 16 },
    { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(statement, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(statement, transactionSheet, "Transactions");
  XLSX.writeFileXLSX(statement, filename);
}

export async function downloadMonthlyStatementExcel({
  year,
  month,
  transactions,
  budgets,
}: MonthlyStatementInput) {
  await downloadTransactionWorkbook({
    title: formatMonthLabel(year, month),
    filename: `monthly-statement-${getMonthKey(year, month)}.xlsx`,
    transactions,
    budgets,
  });
}

export async function downloadMonthlyStatementPdf({
  year,
  month,
  transactions,
  budgets,
}: MonthlyStatementInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const summary = summarize(transactions);
  const categories = categoryBreakdown(transactions);
  const overallBudget = budgets.find((budget) => !budget.category)?.amount ?? null;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  function pageHeader() {
    doc.setFillColor(12, 80, 65);
    doc.rect(0, 0, pageWidth, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Monthly account statement", margin, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(formatMonthLabel(year, month), margin, 24);
    y = 44;
  }

  function newPage() {
    doc.addPage();
    pageHeader();
  }

  function ensureSpace(height: number) {
    if (y + height > pageHeight - 18) newPage();
  }

  function sectionHeading(title: string) {
    ensureSpace(10);
    doc.setTextColor(20, 32, 45);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, margin, y);
    y += 6;
  }

  function summaryLine(label: string, value: string, accent = false) {
    ensureSpace(8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(82, 82, 91);
    doc.text(label, margin + 3, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accent ? 12 : 20, accent ? 80 : 32, accent ? 65 : 45);
    doc.text(value, pageWidth - margin - 3, y, { align: "right" });
    doc.setDrawColor(228, 228, 231);
    doc.line(margin, y + 3, pageWidth - margin, y + 3);
    y += 8;
  }

  function tableHeader() {
    ensureSpace(9);
    doc.setFillColor(244, 244, 245);
    doc.rect(margin, y - 4, contentWidth, 7, "F");
    doc.setTextColor(63, 63, 70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DATE", margin + 2, y);
    doc.text("TYPE", margin + 29, y);
    doc.text("CATEGORY", margin + 49, y);
    doc.text("DESCRIPTION", margin + 83, y);
    doc.text("AMOUNT", pageWidth - margin - 2, y, { align: "right" });
    y += 7;
  }

  pageHeader();
  doc.setTextColor(113, 113, 122);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString("en-BD")}`, margin, y);
  y += 10;

  sectionHeading("Summary");
  summaryLine("Income", money(summary.income), true);
  summaryLine("Expenses", money(summary.expenses));
  summaryLine("Net balance", money(summary.balance), true);
  summaryLine("Savings rate", `${summary.savingsRate.toFixed(1)}%`);
  summaryLine("Overall budget", overallBudget === null ? "Not set" : money(overallBudget));
  summaryLine(
    "Budget remaining",
    overallBudget === null ? "Not set" : money(overallBudget - summary.expenses),
    overallBudget !== null,
  );

  if (categories.length) {
    y += 3;
    sectionHeading("Expense categories");
    categories.forEach((category) => {
      const budget = categoryBudget(budgets, category.category);
      const details = budget === null
        ? `${money(category.amount)} - ${category.percentage.toFixed(1)}%`
        : `${money(category.amount)} of ${money(budget)}`;
      summaryLine(category.category, details);
    });
  }

  y += 3;
  sectionHeading(`Transactions (${transactions.length})`);
  tableHeader();
  sortedTransactions(transactions).forEach((transaction) => {
    const description = transaction.description ?? "-";
    const descriptionLines = doc.splitTextToSize(description, 58) as string[];
    const rowHeight = Math.max(7, descriptionLines.length * 4 + 3);
    if (y + rowHeight > pageHeight - 18) {
      newPage();
      sectionHeading("Transactions (continued)");
      tableHeader();
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(63, 63, 70);
    doc.text(toCalendarDate(transaction.date), margin + 2, y);
    doc.text(transaction.type === "income" ? "Income" : "Expense", margin + 29, y);
    doc.text(transaction.category, margin + 49, y);
    doc.text(descriptionLines, margin + 83, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(transaction.type === "income" ? 5 : 190, transaction.type === "income" ? 115 : 24, transaction.type === "income" ? 85 : 93);
    doc.text(`${transaction.type === "income" ? "+" : "-"}${money(transaction.amount)}`, pageWidth - margin - 2, y, { align: "right" });
    doc.setDrawColor(228, 228, 231);
    doc.line(margin, y + rowHeight - 3, pageWidth - margin, y + rowHeight - 3);
    y += rowHeight;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setTextColor(113, 113, 122);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 9, { align: "right" });
  }

  doc.save(`monthly-statement-${getMonthKey(year, month)}.pdf`);
}
