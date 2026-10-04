import {
  createTransaction,
  type ApiCategory,
  type ApiTransactionType,
  type Budget,
  type CreateTransactionInput,
} from "./api";
import { calendarYearMonth, getMonthKey, type Transaction } from "./finance";

type PendingTransaction = {
  localId: string;
  input: CreateTransactionInput;
};

type OfflineLedger = {
  transactionsByMonth: Record<string, Transaction[]>;
  budgetsByMonth: Record<string, Budget[]>;
  categories: ApiCategory[];
  transactionTypes: ApiTransactionType[];
  pendingTransactions: PendingTransaction[];
};

const STORAGE_PREFIX = "daily_hisab_offline_ledger_v1";

function emptyLedger(): OfflineLedger {
  return {
    transactionsByMonth: {},
    budgetsByMonth: {},
    categories: [],
    transactionTypes: [],
    pendingTransactions: [],
  };
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}`;
}

function readLedger(userId: string): OfflineLedger {
  if (typeof window === "undefined" || !userId) return emptyLedger();

  try {
    const stored = localStorage.getItem(storageKey(userId));
    if (!stored) return emptyLedger();
    const parsed = JSON.parse(stored) as Partial<OfflineLedger>;
    return {
      transactionsByMonth: parsed.transactionsByMonth ?? {},
      budgetsByMonth: parsed.budgetsByMonth ?? {},
      categories: parsed.categories ?? [],
      transactionTypes: parsed.transactionTypes ?? [],
      pendingTransactions: parsed.pendingTransactions ?? [],
    };
  } catch {
    return emptyLedger();
  }
}

function writeLedger(userId: string, ledger: OfflineLedger, requirePersistence = false): void {
  if (typeof window === "undefined" || !userId) return;

  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ledger));
  } catch {
    if (requirePersistence) throw new Error("Could not save the offline transaction. Free browser storage or reconnect and try again.");
    // Offline storage is an enhancement. The current page can still use its
    // in-memory state if a browser blocks storage or it is out of space.
  }
}

export function getOfflineAccount(
  userId: string,
  year: number,
  month: number,
): { transactions: Transaction[]; budgets: Budget[] } | null {
  const ledger = readLedger(userId);
  const key = getMonthKey(year, month);
  const transactions = ledger.transactionsByMonth[key];
  const budgets = ledger.budgetsByMonth[key];

  if (!transactions && !budgets) return null;
  return { transactions: transactions ?? [], budgets: budgets ?? [] };
}

export function saveOfflineAccount(
  userId: string,
  year: number,
  month: number,
  transactions: Transaction[],
  budgets: Budget[],
): void {
  const ledger = readLedger(userId);
  const key = getMonthKey(year, month);
  const pending = (ledger.transactionsByMonth[key] ?? []).filter(
    (transaction) => transaction.pendingSync,
  );
  const pendingIds = new Set(pending.map((transaction) => transaction.id));

  ledger.transactionsByMonth[key] = [
    ...pending,
    ...transactions.filter((transaction) => !pendingIds.has(transaction.id)),
  ];
  ledger.budgetsByMonth[key] = budgets;
  writeLedger(userId, ledger);
}

export function saveOfflineTransactions(
  userId: string,
  year: number,
  month: number,
  transactions: Transaction[],
): void {
  const ledger = readLedger(userId);
  ledger.transactionsByMonth[getMonthKey(year, month)] = transactions;
  writeLedger(userId, ledger);
}

export function saveOfflineLookups(
  userId: string,
  categories: ApiCategory[],
  transactionTypes: ApiTransactionType[],
): void {
  const ledger = readLedger(userId);
  ledger.categories = categories;
  ledger.transactionTypes = transactionTypes;
  writeLedger(userId, ledger);
}

export function getOfflineLookups(
  userId: string,
): { categories: ApiCategory[]; transactionTypes: ApiTransactionType[] } | null {
  const ledger = readLedger(userId);
  if (!ledger.categories.length || !ledger.transactionTypes.length) return null;
  return { categories: ledger.categories, transactionTypes: ledger.transactionTypes };
}

export function queueOfflineTransaction(
  userId: string,
  input: CreateTransactionInput,
  transaction: Transaction,
): void {
  const ledger = readLedger(userId);
  const { year, month } = calendarYearMonth(transaction.date);
  const key = getMonthKey(year, month);
  ledger.transactionsByMonth[key] = [
    transaction,
    ...(ledger.transactionsByMonth[key] ?? []).filter(
      (entry) => entry.id !== transaction.id,
    ),
  ];
  ledger.pendingTransactions = [
    ...ledger.pendingTransactions.filter((entry) => entry.localId !== transaction.id),
    { localId: transaction.id, input: { ...input, clientRequestId: input.clientRequestId ?? crypto.randomUUID() } },
  ];
  writeLedger(userId, ledger, true);
}

async function flushPendingTransactions(userId: string): Promise<Transaction[]> {
  const synced: Transaction[] = [];

  for (const pending of readLedger(userId).pendingTransactions) {
    if (!pending.input.clientRequestId) {
      // Persist keys for legacy queued entries before their first request.
      const ledger = readLedger(userId);
      const entry = ledger.pendingTransactions.find((item) => item.localId === pending.localId);
      if (!entry) continue;
      entry.input.clientRequestId = crypto.randomUUID();
      pending.input.clientRequestId = entry.input.clientRequestId;
      writeLedger(userId, ledger, true);
    }
    const created = await createTransaction(pending.input);
    const ledger = readLedger(userId);
    const { year, month } = calendarYearMonth(pending.input.date);
    const key = getMonthKey(year, month);
    ledger.transactionsByMonth[key] = (ledger.transactionsByMonth[key] ?? []).map(
      (transaction) => (transaction.id === pending.localId ? created : transaction),
    ).filter((transaction, index, entries) => entries.findIndex((entry) => entry.id === transaction.id) === index);
    ledger.pendingTransactions = ledger.pendingTransactions.filter(
      (entry) => entry.localId !== pending.localId,
    );
    writeLedger(userId, ledger);
    synced.push(created);
  }

  return synced;
}

const activeSyncs = new Map<string, Promise<Transaction[]>>();

export function syncOfflineTransactions(userId: string): Promise<Transaction[]> {
  const activeSync = activeSyncs.get(userId);
  if (activeSync) return activeSync;

  const sync = flushPendingTransactions(userId).finally(() => {
    activeSyncs.delete(userId);
  });
  activeSyncs.set(userId, sync);
  return sync;
}
