"use client";

import { useState } from "react";
import {
  downloadTableExcel,
  type ExportRow,
} from "@/lib/monthly-statement";

type Props = {
  filename: string;
  sheetName: string;
  rows: ExportRow[];
  onError: (message: string) => void;
};

export default function ExportExcelButton({
  filename,
  sheetName,
  rows,
  onError,
}: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadTableExcel({ filename, sheetName, rows });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Excel export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleExport()}
      disabled={rows.length === 0 || exporting}
      className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {exporting ? "Creating Excel..." : "Export Excel"}
    </button>
  );
}
