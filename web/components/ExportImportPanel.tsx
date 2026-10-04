"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadFile,
  exportTransactionsCsv,
  exportTransactionsJson,
  importTransactions,
  parseImportCsv,
  parseImportJson,
  type ImportTransactionInput,
} from "@/lib/api";
import {
  downloadMonthlyStatementExcel,
  downloadMonthlyStatementPdf,
} from "@/lib/monthly-statement";
import { formatMonthLabel, getMonthKey, type Transaction } from "@/lib/finance";
import type { Budget } from "@/lib/api";
import { clearImportBatch, loadImportBatch, saveImportBatch } from "@/lib/import-batch";

type Props = {
  year: number;
  month: number;
  transactions: Transaction[];
  budgets: Budget[];
  onImported: () => void;
  onError: (message: string) => void;
};

export default function ExportImportPanel({
  year,
  month,
  transactions,
  budgets,
  onImported,
  onError,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [retryBatch, setRetryBatch] = useState<ImportTransactionInput[] | null>(null);
  const [importMessage, setImportMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      const saved = loadImportBatch();
      if (active && saved) {
        setRetryBatch(saved);
        setImportMessage("An unfinished import is saved on this device. Retry it to continue safely.");
      }
    });
    return () => { active = false; };
  }, []);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const monthKey = getMonthKey(year, month);
  const label = formatMonthLabel(year, month);

  function exportJson() {
    downloadFile(
      exportTransactionsJson(transactions),
      `transactions-${monthKey}.json`,
      "application/json",
    );
  }

  function exportCsv() {
    downloadFile(
      exportTransactionsCsv(transactions),
      `transactions-${monthKey}.csv`,
      "text/csv",
    );
  }

  async function exportExcel() {
    setExporting("excel");
    try {
      await downloadMonthlyStatementExcel({ year, month, transactions, budgets });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Excel export failed");
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    setExporting("pdf");
    try {
      await downloadMonthlyStatementPdf({ year, month, transactions, budgets });
    } catch (err) {
      onError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setExporting(null);
    }
  }

  async function handleImport(file: File) {
    setImporting(true);

    try {
      const raw = await file.text();
      const items =
        file.name.endsWith(".csv") || file.type === "text/csv"
          ? parseImportCsv(raw)
          : parseImportJson(raw);
      const prepared = saveImportBatch(items);
      setRetryBatch(prepared);
      await runImport(prepared);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runImport(items: ImportTransactionInput[]) {
    setImporting(true);
    setImportMessage("");
    try {
      const saved = await importTransactions(items);
      clearImportBatch();
      setImportMessage(`${saved.length} transactions imported.`);
      setRetryBatch(null);
      onImported();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      setImportMessage(message);
      onError(message);
      onImported();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-white">
          Export
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Download {label} transactions ({transactions.length} items).
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportJson}
            disabled={transactions.length === 0}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={transactions.length === 0}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={transactions.length === 0 || exporting !== null}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {exporting === "excel" ? "Creating Excel..." : "Export Excel"}
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={transactions.length === 0 || exporting !== null}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === "pdf" ? "Creating PDF..." : "Download PDF statement"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-white">
          Import
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Upload a JSON or CSV file. Each row is added as a new transaction.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing || retryBatch !== null}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {importing ? "Importing..." : "Choose file to import"}
        </button>
        {retryBatch && <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={importing} onClick={() => void runImport(retryBatch)} className="rounded-xl bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">Retry this import</button>
          <button type="button" disabled={importing} onClick={() => { clearImportBatch(); setRetryBatch(null); setImportMessage("Saved rows remain in your account. Importing the file again starts a new import."); }} className="rounded-xl border px-4 py-2 text-sm">Close import</button>
        </div>}
        {importMessage && <p role="status" className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{importMessage}</p>}
        <p className="mt-3 text-xs text-zinc-400">
          JSON: array of {"{ type, amount, description, category, date }"}.
          CSV columns: date, type, category, description, amount.
        </p>
      </section>
    </div>
  );
}
