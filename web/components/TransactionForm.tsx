"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createTransaction,
  fetchCategories,
  fetchTransactionTypes,
  updateTransaction,
  type ApiCategory,
  type ApiTransactionType,
} from "@/lib/api";
import {
  calendarYearMonth,
  createId,
  monthDateBounds,
  toCalendarDate,
  toDateInputValue,
  type Transaction,
  type TransactionType,
} from "@/lib/finance";
import {
  getOfflineLookups,
  queueOfflineTransaction,
  saveOfflineLookups,
} from "@/lib/offline-ledger";
import { getStoredUser } from "@/lib/auth";
import { CloseIcon, TrendDownIcon, TrendUpIcon } from "./icons";
import CategoryCreator, { CATEGORY_CREATED_EVENT } from "./CategoryCreator";

type FormMode = "create" | "edit";

type Props = {
  year: number;
  month: number;
  editing: Transaction | null;
  onSaved: (
    transaction: Transaction,
    navigatedMonth?: { year: number; month: number },
    queuedOffline?: boolean,
  ) => void;
  onCancelEdit: () => void;
  onError: (message: string) => void;
  quickExpense?: boolean;
};

const fieldClass =
  "w-full rounded-xl border border-brand/10 bg-paper/60 px-4 py-3 text-zinc-900 outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:bg-zinc-800";

type LookupCatalogs = {
  categories: ApiCategory[];
  transactionTypes: ApiTransactionType[];
};

const lookupRefresh = new Map<string, Promise<LookupCatalogs>>();

function refreshLookupCatalogs(): Promise<LookupCatalogs> {
  const userId = getStoredUser()?.id ?? "";
  let refresh = lookupRefresh.get(userId);
  if (!refresh) {
    refresh = Promise.all([fetchCategories(), fetchTransactionTypes()])
      .then(([categories, transactionTypes]) => ({
        categories,
        transactionTypes,
      }))
      .finally(() => {
        lookupRefresh.delete(userId);
      });
    lookupRefresh.set(userId, refresh);
  }
  return refresh;
}

export default function TransactionForm({
  year,
  month,
  editing,
  onSaved,
  onCancelEdit,
  onError,
  quickExpense = false,
}: Props) {
  const creationRequest = useRef<{ signature: string; id: string } | null>(null);
  const mode: FormMode = editing ? "edit" : "create";
  const bounds = monthDateBounds(year, month);
  const defaultDate =
    mode === "edit" && editing
      ? toCalendarDate(editing.date)
      : bounds.max >= toDateInputValue(new Date()) &&
          bounds.min <= toDateInputValue(new Date())
        ? toDateInputValue(new Date())
        : bounds.max;

  const [type, setType] = useState<TransactionType>(
    quickExpense ? "expense" : (editing?.type ?? "expense"),
  );
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [date, setDate] = useState(defaultDate);
  const [submitting, setSubmitting] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<
    ApiTransactionType[]
  >([]);
  const [lookupsReady, setLookupsReady] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const createdCategoriesRef = useRef<ApiCategory[]>([]);

  useEffect(() => {
    function receiveCategory(event: Event) {
      const category = (event as CustomEvent<ApiCategory>).detail;
      if (category.userId !== getStoredUser()?.id) return;
      createdCategoriesRef.current = [
        ...createdCategoriesRef.current,
        category,
      ];
      setCategories((previous) =>
        [
          ...previous.filter((entry) => entry.id !== category.id),
          category,
        ].sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
    window.addEventListener(CATEGORY_CREATED_EVENT, receiveCategory);
    return () =>
      window.removeEventListener(CATEGORY_CREATED_EVENT, receiveCategory);
  }, []);

  useEffect(() => {
    if (!quickExpense) return;
    amountInputRef.current?.focus();
  }, [quickExpense]);

  useEffect(() => {
    let cancelled = false;
    const userId = getStoredUser()?.id ?? "";
    const cached = getOfflineLookups(userId);

    const applyLookups = (
      nextCategories: ApiCategory[],
      nextTypes: ApiTransactionType[],
    ) => {
      const mergedCategories = [
        ...nextCategories,
        ...createdCategoriesRef.current.filter(
          (category) =>
            !nextCategories.some((entry) => entry.id === category.id),
        ),
      ];
      setCategories(mergedCategories);
      setTransactionTypes(nextTypes);
      if (!editing && !quickExpense) {
        const firstExpense = nextCategories.find(
          (category) => category.type === "expense",
        );
        if (firstExpense) {
          setCategoryId((current) => current || firstExpense.id);
        }
      }
      setLookupsReady(true);
    };

    // Render previously saved catalogs immediately, then refresh them without
    // making the transaction form wait for the network.
    if (cached) applyLookups(cached.categories, cached.transactionTypes);

    refreshLookupCatalogs()
      .then(({ categories: nextCategories, transactionTypes: nextTypes }) => {
        if (cancelled) return;
        applyLookups(nextCategories, nextTypes);
        if (userId)
          saveOfflineLookups(
            userId,
            [
              ...nextCategories,
              ...createdCategoriesRef.current.filter(
                (category) =>
                  !nextCategories.some((entry) => entry.id === category.id),
              ),
            ],
            nextTypes,
          );
      })
      .catch((err) => {
        if (cancelled) return;
        if (cached) {
          return;
        }
        onError(
          err instanceof Error ? err.message : "Failed to load categories",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [editing, onError, quickExpense]);

  const categoriesForType = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  );

  function handleTypeChange(next: TransactionType) {
    setType(next);
    const first = categories.find((category) => category.type === next);
    setCategoryId(first?.id ?? "");
  }

  function handleCategoryCreated(category: ApiCategory) {
    const next = [
      ...categories.filter((entry) => entry.id !== category.id),
      category,
    ].sort((a, b) => a.name.localeCompare(b.name));
    setCategories(next);
    setCategoryId(category.id);
    const userId = getStoredUser()?.id;
    if (userId) saveOfflineLookups(userId, next, transactionTypes);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (creatingCategory) return;

    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    const transactionType = transactionTypes.find(
      (entry) => entry.name === type,
    );
    if (!transactionType || !categoryId) {
      onError("Categories are still loading. Try again in a moment.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        transactionTypeId: transactionType.id,
        categoryId,
        amount: parsed,
        description: description.trim() || null,
        date,
      };
      const signature = JSON.stringify(payload);
      if (mode === "create" && creationRequest.current?.signature !== signature) {
        creationRequest.current = { signature, id: crypto.randomUUID() };
      }
      const createPayload = { ...payload, clientRequestId: creationRequest.current?.id };

      const selectedCategory = categories.find(
        (category) => category.id === categoryId,
      );
      const userId = getStoredUser()?.id;

      if (mode === "create" && !navigator.onLine) {
        if (!userId || !selectedCategory) {
          onError(
            "Connect to the internet before adding your first offline transaction.",
          );
          return;
        }

        const entry: Transaction = {
          id: `offline-${createId()}`,
          type,
          amount: parsed,
          description: payload.description,
          category: selectedCategory.name,
          categoryId: selectedCategory.id,
          transactionTypeId: transactionType.id,
          categoryIcon: selectedCategory.icon,
          date: toCalendarDate(date),
          pendingSync: true,
        };
        queueOfflineTransaction(userId, createPayload, entry);
        creationRequest.current = null;
        const { year: txYear, month: txMonth } = calendarYearMonth(entry.date);

        setAmount("");
        setDescription("");
        onSaved(
          entry,
          txYear !== year || txMonth !== month
            ? { year: txYear, month: txMonth }
            : undefined,
          true,
        );
        return;
      }

      const entry =
        mode === "edit" && editing
          ? await updateTransaction(editing.id, payload)
          : await createTransaction(createPayload);
      creationRequest.current = null;

      const { year: txYear, month: txMonth } = calendarYearMonth(entry.date);

      if (mode === "create") {
        setAmount("");
        setDescription("");
        setDate(
          bounds.max >= toDateInputValue(new Date()) &&
            bounds.min <= toDateInputValue(new Date())
            ? toDateInputValue(new Date())
            : bounds.max,
        );
      }

      onSaved(
        entry,
        txYear !== year || txMonth !== month
          ? { year: txYear, month: txMonth }
          : undefined,
      );
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Failed to save transaction",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (quickExpense) {
    return (
      <section className="w-full overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-brand/10 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
              দ্রুত এন্ট্রি
            </p>
            <h2
              id="quick-expense-title"
              className="mt-0.5 text-lg font-semibold text-brand dark:text-white"
            >
              খরচ যোগ করুন
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-full p-2 text-zinc-500 transition hover:bg-brand/5 hover:text-brand dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label="বন্ধ করুন"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div>
            <label
              htmlFor="quick-expense-amount"
              className="mb-2 block text-sm font-semibold text-zinc-800 dark:text-zinc-100"
            >
              কত টাকা?
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-brand/60 dark:text-zinc-400">
                ৳
              </span>
              <input
                ref={amountInputRef}
                id="quick-expense-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${fieldClass} py-4 pl-10 text-2xl font-bold tabular-nums`}
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="quick-expense-date"
              className="mb-2 block text-sm font-semibold text-zinc-800 dark:text-zinc-100"
            >
              {"\u09A4\u09BE\u09B0\u09BF\u0996"}
            </label>
            <input
              id="quick-expense-date"
              type="date"
              value={date}
              min={bounds.min}
              max={bounds.max}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
              required
            />
          </div>

          <fieldset>
            <legend className="mb-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              ক্যাটাগরি
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {!lookupsReady ? (
                <p className="col-span-full rounded-xl bg-brand/5 px-3 py-4 text-center text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  ক্যাটাগরি লোড হচ্ছে...
                </p>
              ) : categoriesForType.length === 0 ? (
                <p className="col-span-full rounded-xl bg-amber-50 px-3 py-4 text-center text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  কোনো খরচের ক্যাটাগরি পাওয়া যায়নি।
                </p>
              ) : (
                categoriesForType.map((category) => {
                  const selected = categoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategoryId(category.id)}
                      aria-pressed={selected}
                      className={`flex min-h-16 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                        selected
                          ? "border-brand bg-brand text-white shadow-sm"
                          : "border-brand/10 bg-paper/50 text-zinc-700 hover:border-brand/30 hover:bg-brand/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      <span className="text-xl" aria-hidden="true">
                        {category.icon || "📦"}
                      </span>
                      <span className="min-w-0 truncate">{category.name}</span>
                    </button>
                  );
                })
              )}
            </div>
            <CategoryCreator
              type="expense"
              disabled={!lookupsReady || submitting}
              onCreated={handleCategoryCreated}
              onBusyChange={setCreatingCategory}
            />
          </fieldset>

          <button
            type="submit"
            disabled={
              submitting || creatingCategory || !lookupsReady || !categoryId
            }
            className="w-full rounded-xl bg-rose-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-zinc-900 ${
        mode === "edit"
          ? "border-gold/40 dark:border-gold/30"
          : "border-brand/10 dark:border-zinc-800"
      }`}
    >
      {mode === "edit" && (
        <div className="flex items-center justify-between gap-3 border-b border-gold/20 bg-gold/10 px-5 py-2.5">
          <p className="truncate text-sm font-medium text-brand dark:text-gold">
            Editing {editing?.description || "transaction"}
          </p>
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-lg p-1 text-brand/60 transition hover:bg-white/70 hover:text-brand dark:text-gold/70 dark:hover:bg-zinc-800 dark:hover:text-gold"
            aria-label="Cancel edit"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              Ledger entry
            </p>
            <h2 className="mt-1 text-base font-semibold text-brand dark:text-white">
              {mode === "edit" ? "Update transaction" : "Post a transaction"}
            </h2>
          </div>
          {mode === "create" && (
            <span className="mt-1 rounded-full border border-brand/10 bg-brand/5 px-2.5 py-0.5 text-[11px] font-medium text-brand/70 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              New
            </span>
          )}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-brand/5 p-1 dark:bg-zinc-800">
          {(["expense", "income"] as const).map((option) => {
            const active = type === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleTypeChange(option)}
                disabled={creatingCategory}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold capitalize transition ${
                  active
                    ? option === "income"
                      ? "bg-white text-brand shadow-sm dark:bg-zinc-900 dark:text-gold"
                      : "bg-white text-rose-600 shadow-sm dark:bg-zinc-900 dark:text-rose-400"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                {option === "income" ? <TrendUpIcon /> : <TrendDownIcon />}
                {option}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="amount"
                className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >
                Amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-brand/50 dark:text-zinc-400">
                  ৳
                </span>
                <input
                  ref={amountInputRef}
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`${fieldClass} pl-8 text-lg font-semibold tabular-nums`}
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="date"
                className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >
                Date
              </label>
              <input
                id="date"
                type="date"
                value={date}
                min={bounds.min}
                max={bounds.max}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="category"
                className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >
                Category
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={fieldClass}
                required
                disabled={!lookupsReady}
              >
                {categoriesForType.length === 0 ? (
                  <option value="">
                    {lookupsReady ? "No categories" : "Loading..."}
                  </option>
                ) : (
                  categoriesForType.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon ? `${category.icon} ` : ""}
                      {category.name}
                    </option>
                  ))
                )}
              </select>
              <CategoryCreator
                key={type}
                type={type}
                disabled={!lookupsReady || submitting}
                onCreated={handleCategoryCreated}
                onBusyChange={setCreatingCategory}
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >
                Description (optional)
              </label>
              <input
                id="description"
                type="text"
                placeholder="e.g. Grocery run, paycheck..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={
              submitting || creatingCategory || !lookupsReady || !categoryId
            }
            className={`w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
              type === "income"
                ? "bg-brand shadow-brand/20 hover:bg-brand-deep"
                : "bg-rose-500 shadow-rose-500/20 hover:bg-rose-600"
            }`}
          >
            {submitting
              ? "Saving..."
              : mode === "edit"
                ? "Save changes"
                : `Add ${type}`}
          </button>
        </form>
      </div>
    </section>
  );
}
