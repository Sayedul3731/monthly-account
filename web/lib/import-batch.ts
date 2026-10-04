import { getStoredUser } from "./auth";
import type { ImportTransactionInput } from "./api";

function key(): string {
  const userId = getStoredUser()?.id;
  if (!userId) throw new Error("Sign in before importing transactions.");
  return `daily_hisab_pending_import_v1:${encodeURIComponent(userId)}`;
}

export function saveImportBatch(items: ImportTransactionInput[]): ImportTransactionInput[] {
  const prepared = items.map((item) => ({ ...item, clientRequestId: item.clientRequestId ?? crypto.randomUUID() }));
  try { localStorage.setItem(key(), JSON.stringify(prepared)); }
  catch { throw new Error("Could not save import progress. Allow browser storage before importing."); }
  return prepared;
}

export function loadImportBatch(): ImportTransactionInput[] | null {
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.length || !value.every((item: unknown) => {
      if (!item || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return typeof row.clientRequestId === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.clientRequestId);
    })) return null;
    return value as ImportTransactionInput[];
  } catch { return null; }
}

export function clearImportBatch(): void {
  try { localStorage.removeItem(key()); } catch { /* A retained batch can still be retried safely. */ }
}
