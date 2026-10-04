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

type SheetCell = string | number | boolean | null | undefined;

type WorkbookSheet = {
  name: string;
  rows: SheetCell[][];
  widths: number[];
  currencyCells?: string[];
  percentageCells?: string[];
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function cellXml(value: SheetCell, reference: string, style = 0) {
  const styleAttribute = style ? ` s="${style}"` : "";
  if (value === null || value === undefined || value === "") {
    return `<c r="${reference}"${styleAttribute}/>`;
  }
  if (typeof value === "number") {
    return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  const preserveWhitespace = /^\s|\s$/.test(value) ? ' xml:space="preserve"' : "";
  return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t${preserveWhitespace}>${escapeXml(value)}</t></is></c>`;
}

async function downloadWorkbook(sheets: WorkbookSheet[], filename: string) {
  const { strToU8, zipSync } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  const toBytes = (xml: string) => strToU8(xml);
  const formatCells = (cells: string[] | undefined, style: number) =>
    new Set(cells?.map((cell) => `${cell}:${style}`));

  sheets.forEach((sheet, index) => {
    const styles = new Set([
      ...formatCells(sheet.currencyCells, 1),
      ...formatCells(sheet.percentageCells, 2),
    ]);
    const rows = sheet.rows
      .map((values, rowIndex) => {
        const cells = values
          .map((value, columnIndex) => {
            const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
            const style =
              rowIndex === 0
                ? 3
                : styles.has(`${reference}:1`)
                  ? 1
                  : styles.has(`${reference}:2`)
                    ? 2
                    : 0;
            return cellXml(value, reference, style);
          })
          .join("");
        return `<row r="${rowIndex + 1}">${cells}</row>`;
      })
      .join("");
    const columns = sheet.widths
      .map(
        (width, columnIndex) =>
          `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${width}" customWidth="1"/>`,
      )
      .join("");
    files[`xl/worksheets/sheet${index + 1}.xml`] = toBytes(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${columns}</cols><sheetData>${rows}</sheetData></worksheet>`,
    );
  });

  files["[Content_Types].xml"] = toBytes(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
  );
  files["_rels/.rels"] = toBytes(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  files["xl/workbook.xml"] = toBytes(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`,
  );
  files["xl/_rels/workbook.xml.rels"] = toBytes(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  files["xl/styles.xml"] = toBytes(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;BDT&quot; #,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
  );

  const blob = new Blob([zipSync(files, { level: 6 })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  await downloadWorkbook([
    {
      name: sheetName,
      rows: [headers, ...rows.map((row) => headers.map((header) => row[header]))],
      widths: headers.map((header) => Math.min(
      36,
      Math.max(
        12,
        header.length + 2,
        ...rows.map((row) => String(row[header] ?? "").length + 2),
      ),
      )),
    },
  ], filename);
}

export async function downloadTransactionWorkbook({
  title,
  filename,
  transactions,
  budgets = [],
}: TransactionWorkbookInput) {
  const summary = summarize(transactions);
  const categories = categoryBreakdown(transactions);
  const overallBudget = budgets.find((budget) => !budget.category)?.amount ?? null;

  const summaryRows: SheetCell[][] = [
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
  ];
  const transactionRows: SheetCell[][] = [
    ["Date", "Type", "Category", "Description", "Amount (BDT)", "Sync status"],
    ...sortedTransactions(transactions).map((transaction) => [
      toCalendarDate(transaction.date),
      transaction.type === "income" ? "Income" : "Expense",
      transaction.category,
      transaction.description ?? "",
      transaction.amount,
      transaction.pendingSync ? "Pending sync" : "Synced",
    ]),
  ];
  await downloadWorkbook([
    {
      name: "Summary",
      rows: summaryRows,
      widths: [24, 18, 14, 18, 20],
      currencyCells: ["B6", "B7", "B8", "B11", "B12"],
      percentageCells: ["B9"],
    },
    {
      name: "Transactions",
      rows: transactionRows,
      widths: [14, 12, 20, 38, 16, 16],
      currencyCells: transactionRows.slice(1).map((_, index) => `E${index + 2}`),
    },
  ], filename);
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
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-bengali").trim() || '"Nirmala UI", sans-serif';
  await document.fonts.load(`16px ${fontFamily}`);
  await document.fonts.ready;
  const pixelsPerMm = (96 / 25.4) * 4;

  function canvasContext() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser cannot render this PDF. Try the Excel export.");
    context.font = `${doc.getFont().fontStyle === "bold" ? "700" : "400"} ${doc.getFontSize() * (96 / 72) * 4}px ${fontFamily}`;
    return { canvas, context };
  }

  function wrapText(value: string, width: number): string[] {
    if (/^[\x20-\x7e\n\r]*$/.test(value)) return doc.splitTextToSize(value, width) as string[];
    const { context } = canvasContext();
    const lines: string[] = [];
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const paragraph of value.split(/\r?\n/)) {
      let line = "";
      for (const { segment } of segmenter.segment(paragraph)) {
        if (line && context.measureText(line + segment).width > width * pixelsPerMm) {
          lines.push(line); line = "";
        }
        line += segment;
      }
      lines.push(line);
    }
    return lines;
  }

  function drawText(value: string | string[], x: number, baseline: number) {
    const lines = Array.isArray(value) ? value : [value];
    lines.forEach((line, index) => {
      const lineY = baseline + index * 4;
      if (!line) return;
      if (/^[\x20-\x7e]*$/.test(line)) { doc.text(line, x, lineY); return; }
      // Browser shaping preserves Bengali conjuncts and emoji; built-in PDF
      // fonts cannot shape them. Rasterize only these lines at high resolution.
      const { canvas, context } = canvasContext();
      const metrics = context.measureText(line);
      const ascent = Math.ceil(metrics.actualBoundingBoxAscent || doc.getFontSize() * 5);
      const descent = Math.ceil(metrics.actualBoundingBoxDescent || doc.getFontSize() * 2);
      const padding = 6;
      canvas.width = Math.max(1, Math.ceil(metrics.width + padding * 2));
      canvas.height = Math.max(1, ascent + descent + padding * 2);
      context.font = `${doc.getFont().fontStyle === "bold" ? "700" : "400"} ${doc.getFontSize() * (96 / 72) * 4}px ${fontFamily}`;
      context.fillStyle = doc.getTextColor();
      context.fillText(line, padding, padding + ascent);
      doc.addImage(canvas.toDataURL("image/png"), "PNG", x - padding / pixelsPerMm, lineY - (ascent + padding) / pixelsPerMm, canvas.width / pixelsPerMm, canvas.height / pixelsPerMm);
    });
  }
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
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const labelLines = wrapText(label, 80);
    const height = Math.max(8, labelLines.length * 4 + 4);
    ensureSpace(height);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(82, 82, 91);
    drawText(labelLines, margin + 3, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accent ? 12 : 20, accent ? 80 : 32, accent ? 65 : 45);
    doc.text(value, pageWidth - margin - 3, y, { align: "right" });
    doc.setDrawColor(228, 228, 231);
    doc.line(margin, y + height - 5, pageWidth - margin, y + height - 5);
    y += height;
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
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const descriptionLines = wrapText(description, 58);
    const categoryLines = wrapText(transaction.category, 31);
    const rowHeight = Math.max(7, Math.max(descriptionLines.length, categoryLines.length) * 4 + 3);
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
    drawText(categoryLines, margin + 49, y);
    drawText(descriptionLines, margin + 83, y);
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
