"use client";

import { useRef, useState } from "react";
import {
  downloadFile,
  exportTransactionsCsv,
  exportTransactionsJson,
  importTransactions,
  parseImportCsv,
  parseImportJson,
} from "@/lib/api";
import { formatMonthLabel, getMonthKey, type Transaction } from "@/lib/finance";

type Props = {
  year: number;
  month: number;
  transactions: Transaction[];
  onImported: () => void;
  onError: (message: string) => void;
};

export default function ExportImportPanel({
  year,
  month,
  transactions,
  onImported,
  onError,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

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

  async function handleImport(file: File) {
    setImporting(true);

    try {
      const raw = await file.text();
      const items =
        file.name.endsWith(".csv") || file.type === "text/csv"
          ? parseImportCsv(raw)
          : parseImportJson(raw);

      await importTransactions(items);
      onImported();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
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
          disabled={importing}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {importing ? "Importing..." : "Choose file to import"}
        </button>
        <p className="mt-3 text-xs text-zinc-400">
          JSON: array of {"{ type, amount, description, category, date }"}.
          CSV columns: date, type, category, description, amount.
        </p>
      </section>
    </div>
  );
}
