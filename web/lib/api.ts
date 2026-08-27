import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  setAuthSession,
  updateStoredUser,
  type AuthResponse,
  type AuthUser,
} from "./auth";
import {
  CATEGORY_ICONS,
  toCalendarDate,
  type Transaction,
  type TransactionType,
} from "./finance";
import { hashPasswordForTransport } from "./password";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ApiCategory = {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
};

export type ApiTransactionType = {
  id: string;
  name: string;
  label: string;
  icon: string;
};

export type CreateTransactionInput = {
  transactionTypeId: string;
  categoryId: string;
  amount: number;
  description: string;
  date: string;
};

type UpdateTransactionInput = Partial<CreateTransactionInput>;

export type ImportTransactionInput = {
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  date: string;
};

export type Budget = {
  id: string;
  year: number;
  month: number;
  category: string;
  amount: number;
};

type UpsertBudgetInput = {
  year: number;
  month: number;
  category?: string | null;
  amount: number;
};

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type UpdateProfileInput = {
  name?: string;
  email?: string;
  password?: string;
};

function normalizeAuthUser(raw: AuthUser): AuthUser {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role
      ? { id: raw.role.id, name: raw.role.name }
      : undefined,
    createdAt:
      raw.createdAt != null ? String(raw.createdAt) : undefined,
    updatedAt:
      raw.updatedAt != null ? String(raw.updatedAt) : undefined,
  };
}

function applyAuthSession(data: AuthResponse): AuthUser {
  const user = normalizeAuthUser(data.user);
  setAuthSession(data.accessToken, user, data.refreshToken);
  return user;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Request failed (${response.status})`;

  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(". ");
    if (typeof body.message === "string") return body.message;
  } catch {
    // response was not JSON
  }

  return text;
}

function toApiError(err: unknown): Error {
  if (err instanceof TypeError) {
    return new Error(
      "Cannot reach the API. Make sure it is running and NEXT_PUBLIC_API_URL is correct.",
    );
  }
  if (err instanceof Error) return err;
  return new Error("Request failed");
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearAuthSession();
      return false;
    }

    const data = (await response.json()) as AuthResponse;
    applyAuthSession(data);
    return true;
  } catch {
    clearAuthSession();
    return false;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retryOnUnauthorized = true,
): Promise<T> {
  let response: Response;

  try {
    const token = getAccessToken();
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    throw toApiError(err);
  }

  if (
    response.status === 401 &&
    retryOnUnauthorized &&
    path !== "/auth/login" &&
    path !== "/auth/register" &&
    path !== "/auth/refresh"
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, init, false);
    }
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  const data = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: await hashPasswordForTransport(input.password),
    }),
  });
  return applyAuthSession(data);
}

export async function loginUser(input: LoginInput): Promise<AuthUser> {
  const data = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: await hashPasswordForTransport(input.password),
    }),
  });
  return applyAuthSession(data);
}

export async function logoutUser(): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST" }, false);
  } catch {
    // Always clear local session even if the API call fails
  } finally {
    clearAuthSession();
  }
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await request<AuthUser>("/auth/me");
  const user = normalizeAuthUser(data);
  updateStoredUser(user);
  return user;
}

export async function updateProfile(
  input: UpdateProfileInput,
): Promise<AuthUser> {
  const body: Record<string, string> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.email !== undefined) body.email = input.email.trim().toLowerCase();
  if (input.password !== undefined) {
    body.password = await hashPasswordForTransport(input.password);
  }

  const data = await request<AuthUser>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const user = normalizeAuthUser(data);
  updateStoredUser(user);
  return user;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nestedString(value: unknown, key: string): string {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value[key] === "string") {
    return value[key];
  }
  return "";
}

type RawTransaction = {
  id: string;
  amount: number;
  description: string;
  date: string;
  categoryId?: string;
  transactionTypeId?: string;
  category?: unknown;
  transactionType?: unknown;
  type?: TransactionType;
};

function normalizeTransaction(raw: RawTransaction): Transaction {
  const typeName = nestedString(raw.transactionType, "name") || raw.type;
  const categoryName = nestedString(raw.category, "name");

  return {
    id: raw.id,
    type: typeName === "income" ? "income" : "expense",
    amount: Number(raw.amount),
    description: raw.description,
    category: categoryName,
    categoryId: raw.categoryId || nestedString(raw.category, "id"),
    transactionTypeId:
      raw.transactionTypeId || nestedString(raw.transactionType, "id"),
    categoryIcon:
      nestedString(raw.category, "icon") ||
      CATEGORY_ICONS[categoryName] ||
      "📌",
    date: raw.date,
  };
}

function normalizeBudget(raw: Budget): Budget {
  return {
    ...raw,
    amount: Number(raw.amount),
  };
}

export async function fetchTransactions(
  year: number,
  month: number,
): Promise<Transaction[]> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const data = await request<RawTransaction[]>(`/transactions?${params}`);
  return data.map(normalizeTransaction);
}

export async function fetchCategories(
  type?: TransactionType,
): Promise<ApiCategory[]> {
  const params = type ? `?type=${type}` : "";
  return request<ApiCategory[]>(`/categories${params}`);
}

export async function fetchTransactionTypes(): Promise<ApiTransactionType[]> {
  return request<ApiTransactionType[]>("/transaction-types");
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  const data = await request<RawTransaction>("/transactions", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      date: toCalendarDate(input.date),
    }),
  });
  return normalizeTransaction(data);
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<Transaction> {
  const data = await request<RawTransaction>(`/transactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...input,
      date: input.date ? toCalendarDate(input.date) : undefined,
    }),
  });
  return normalizeTransaction(data);
}

export async function deleteTransaction(id: string): Promise<void> {
  await request<void>(`/transactions/${id}`, { method: "DELETE" });
}

export async function fetchBudgets(
  year: number,
  month: number,
): Promise<Budget[]> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const data = await request<Budget[]>(`/budgets?${params}`);
  return data.map(normalizeBudget);
}

export async function upsertBudget(
  input: UpsertBudgetInput,
): Promise<Budget> {
  const data = await request<Budget>("/budgets", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return normalizeBudget(data);
}

export async function deleteBudget(id: string): Promise<void> {
  await request<void>(`/budgets/${id}`, { method: "DELETE" });
}

export async function importTransactions(
  items: ImportTransactionInput[],
): Promise<Transaction[]> {
  const [types, categories] = await Promise.all([
    fetchTransactionTypes(),
    fetchCategories(),
  ]);

  const results: Transaction[] = [];
  for (const item of items) {
    const type = types.find((entry) => entry.name === item.type);
    const category = categories.find(
      (entry) => entry.name === item.category && entry.type === item.type,
    );

    if (!type) {
      throw new Error(`Unknown transaction type "${item.type}"`);
    }
    if (!category) {
      throw new Error(
        `Unknown category "${item.category}" for type "${item.type}"`,
      );
    }

    results.push(
      await createTransaction({
        transactionTypeId: type.id,
        categoryId: category.id,
        amount: item.amount,
        description: item.description,
        date: toCalendarDate(item.date),
      }),
    );
  }
  return results;
}

export function exportTransactionsJson(transactions: Transaction[]): string {
  return JSON.stringify(transactions, null, 2);
}

export function exportTransactionsCsv(transactions: Transaction[]): string {
  const header = "date,type,category,description,amount";
  const rows = transactions.map((t) => {
    const date = t.date.slice(0, 10);
    const desc = `"${t.description.replace(/"/g, '""')}"`;
    return `${date},${t.type},${t.category},${desc},${t.amount}`;
  });
  return [header, ...rows].join("\n");
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseImportJson(raw: string): ImportTransactionInput[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Import file must be a JSON array of transactions");
  }

  return parsed.map((item, index) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("type" in item) ||
      !("amount" in item) ||
      !("description" in item) ||
      !("category" in item) ||
      !("date" in item)
    ) {
      throw new Error(`Invalid transaction at index ${index}`);
    }

    const record = item as Record<string, unknown>;
    const categoryValue = record.category;
    const categoryName =
      typeof categoryValue === "string"
        ? categoryValue
        : nestedString(categoryValue, "name");

    return {
      type: record.type as TransactionType,
      amount: Number(record.amount),
      description: String(record.description),
      category: categoryName,
      date: toCalendarDate(String(record.date)),
    };
  });
}

export function parseImportCsv(raw: string): ImportTransactionInput[] {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one transaction");
  }

  const header = lines[0].toLowerCase();
  if (!header.includes("date") || !header.includes("amount")) {
    throw new Error("CSV must include date, type, category, description, and amount columns");
  }

  return lines.slice(1).filter(Boolean).map((line, index) => {
    const match = line.match(
      /^([^,]+),([^,]+),([^,]+),("(?:[^"]|"")*"|[^,]*),([^,]+)$/,
    );
    if (!match) {
      throw new Error(`Invalid CSV row at line ${index + 2}`);
    }

    const [, date, type, category, description, amount] = match;
    const cleanDescription = description.startsWith('"')
      ? description.slice(1, -1).replace(/""/g, '"')
      : description;

    return {
      type: type as TransactionType,
      amount: parseFloat(amount),
      description: cleanDescription,
      category,
      date: toCalendarDate(date),
    };
  });
}
