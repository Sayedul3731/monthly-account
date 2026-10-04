import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function moduleFixture(path, dependencies, globals = {}) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  runInNewContext(compiled.outputText, { exports, require: (name) => dependencies[name], crypto: { randomUUID }, process: { env: { NEXT_PUBLIC_API_URL: "http://localhost:3001" } }, URLSearchParams, ...globals });
  return exports;
}

function apiFixture(respond) {
  const calls = [];
  const api = moduleFixture("../lib/api.ts", { "./auth": { getCsrfToken: () => "csrf", clearAuthSession() {} }, "./finance": { CATEGORY_ICONS: {}, toCalendarDate: (date) => date.slice(0, 10) } }, {
    fetch: async (url, init) => { calls.push({ url, init }); return respond(url, init); },
  });
  return { api, calls };
}

function catalogResponse(url) {
  if (url.includes("transaction-types")) return Response.json([{ id: "expense-type", name: "expense" }]);
  if (url.includes("categories")) return Response.json([{ id: "food", name: "Food", type: "expense" }]);
}

const item = { type: "expense", category: "Food", amount: 10, description: null, date: "2026-10-04" };

test("imports validate every reference and value before saving any row", async () => {
  const { api, calls } = apiFixture((url) => catalogResponse(url));
  for (const bad of [{ category: "Unknown" }, { amount: NaN }, { amount: -1 }, { amount: 1.234 }, { date: "2026-02-31" }, { description: "x".repeat(256) }]) {
    await assert.rejects(api.importTransactions([{ ...item }, { ...item, ...bad }]));
  }
  assert.equal(calls.filter((call) => call.init?.method === "POST").length, 0);
});

test("partial import reports progress and retry reuses every row's request ID", async () => {
  const stored = new Map();
  let loseResponse = true;
  const { api } = apiFixture((url, init) => {
    const lookup = catalogResponse(url);
    if (lookup) return lookup;
    const input = JSON.parse(init.body);
    if (!stored.has(input.clientRequestId)) stored.set(input.clientRequestId, input);
    if (input.amount === 20 && loseResponse) { loseResponse = false; throw new Error("Response lost after save"); }
    return Response.json({ id: input.clientRequestId, ...input, category: { name: "Food", type: "expense" }, transactionType: { name: "expense" } });
  });
  const batch = [{ ...item }, { ...item, amount: 20 }];
  await assert.rejects(api.importTransactions(batch), (error) => error instanceof api.PartialImportError && error.completed === 1 && error.failedRow === 2);
  const keys = batch.map((row) => row.clientRequestId);
  await api.importTransactions(batch);
  assert.deepEqual(batch.map((row) => row.clientRequestId), keys);
  assert.equal(stored.size, 2);
});

test("CSV export/import preserves commas, quotes, multiline descriptions, Bengali text, and reordered columns", () => {
  const { api } = apiFixture(() => {});
  const entries = [{ id: "one", ...item, category: 'খাবার, "বাজার"', description: 'প্রথম লাইন\nSecond "line"' }];
  const parsed = api.parseImportCsv(api.exportTransactionsCsv(entries));
  assert.equal(parsed[0].category, entries[0].category);
  assert.equal(parsed[0].description, entries[0].description);
  const reordered = api.parseImportCsv("amount,category,type,date,description\n10,Food,expense,2026-10-04,Test");
  assert.equal(reordered[0].amount, 10);
  assert.equal(reordered[0].date, "2026-10-04");
  assert.throws(() => api.parseImportCsv('date,type,category,description,amount\n2026-10-04,expense,Food,"Unclosed,10'));
});

function ledgerFixture(createTransaction, setFailure = false) {
  const storage = new Map();
  const localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { if (setFailure) throw new Error("Quota exceeded"); storage.set(key, value); } };
  const ledger = moduleFixture("../lib/offline-ledger.ts", {
    "./api": { createTransaction },
    "./finance": { calendarYearMonth: (date) => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 }), getMonthKey: (year, month) => `${year}-${month}` },
  }, { window: {}, localStorage });
  return { ledger, storage };
}

test("offline sync survives a lost response without creating a second transaction", async () => {
  const saved = new Map();
  const keys = [];
  let loseResponse = true;
  const { ledger } = ledgerFixture(async (input) => {
    keys.push(input.clientRequestId);
    if (!saved.has(input.clientRequestId)) saved.set(input.clientRequestId, { ...input, id: input.clientRequestId });
    if (loseResponse) { loseResponse = false; throw new Error("Connection lost"); }
    return saved.get(input.clientRequestId);
  });
  const input = { transactionTypeId: "expense", categoryId: "food", amount: 10, description: null, date: "2026-10-04" };
  ledger.queueOfflineTransaction("alice", input, { ...input, id: "offline-one", type: "expense", category: "Food", pendingSync: true });
  await assert.rejects(ledger.syncOfflineTransactions("alice"));
  const synced = await ledger.syncOfflineTransactions("alice");
  assert.equal(keys[0], keys[1]);
  assert.equal(saved.size, 1);
  assert.equal(synced.length, 1);
  assert.equal(ledger.getOfflineAccount("alice", 2026, 9).transactions[0].pendingSync, undefined);
  assert.equal((await ledger.syncOfflineTransactions("alice")).length, 0);
  assert.equal(ledger.getOfflineAccount("bob", 2026, 9), null);
});

test("offline creation reports storage failure instead of claiming it was saved", () => {
  const { ledger } = ledgerFixture(() => {}, true);
  assert.throws(() => ledger.queueOfflineTransaction("alice", { ...item }, { ...item, id: "offline-one" }), /Could not save/);
});

test("unfinished import retains retry IDs after reload and is scoped to the current user", () => {
  const storage = new Map();
  let userId = "alice";
  const batch = moduleFixture("../lib/import-batch.ts", { "./auth": { getStoredUser: () => ({ id: userId }) } }, {
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
  });
  const prepared = batch.saveImportBatch([{ ...item }]);
  assert.equal(batch.loadImportBatch()[0].clientRequestId, prepared[0].clientRequestId);
  userId = "bob";
  assert.equal(batch.loadImportBatch(), null);
  userId = "alice";
  batch.clearImportBatch();
  assert.equal(batch.loadImportBatch(), null);
});
