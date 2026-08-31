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
const API_URL = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3001"
).replace(/\/$/, "");

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
  description: string | null;
  date: string;
};

type UpdateTransactionInput = Partial<CreateTransactionInput>;

export type ImportTransactionInput = {
  type: TransactionType;
  amount: number;
  description: string | null;
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

export type MembershipType = "free" | "paid";
export type BillingInterval = "monthly" | "yearly";

type UpdateProfileInput = {
  name?: string;
  email?: string;
  password?: string;
  membershipId?: string;
  billingInterval?: BillingInterval | null;
};

export type Membership = {
  id: string;
  name: string;
  type: MembershipType;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
};

export type AppRole = {
  id: string;
  name: string;
  description: string | null;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  membershipId: string;
  billingInterval: BillingInterval | null;
  role?: { id: string; name: string };
  membership?: Membership;
  createdAt?: string;
  updatedAt?: string;
};

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  roleId?: string;
  membershipId?: string;
  billingInterval?: BillingInterval;
};

type UpdateUserInput = {
  name?: string;
  email?: string;
  password?: string;
  roleId?: string;
  membershipId?: string;
  billingInterval?: BillingInterval | null;
};

type RoleInput = {
  name: string;
  description?: string | null;
};

type MembershipPlanInput = {
  name: string;
  type: MembershipType;
  description?: string | null;
  monthlyPrice?: number;
  yearlyPrice?: number;
};

type CategoryInput = {
  name: string;
  type: TransactionType;
  icon?: string;
};

type TransactionTypeInput = {
  name: string;
  label: string;
  icon?: string;
};

function normalizeMembership(
  raw: AuthUser["membership"] | Membership | undefined,
): AuthUser["membership"] | undefined {
  if (!raw?.id) return undefined;
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type === "paid" ? "paid" : "free",
    monthlyPrice: Number(raw.monthlyPrice ?? 0),
    yearlyPrice: Number(raw.yearlyPrice ?? 0),
    description: raw.description ?? null,
  };
}

function normalizeAuthUser(raw: AuthUser): AuthUser {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role
      ? { id: raw.role.id, name: raw.role.name }
      : undefined,
    billingInterval:
      raw.billingInterval === "yearly"
        ? "yearly"
        : raw.billingInterval === "monthly"
          ? "monthly"
          : null,
    membership: normalizeMembership(raw.membership),
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

let refreshPromise: Promise<boolean> | null = null;

async function performTokenRefresh(): Promise<boolean> {
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

function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
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
      password: input.password,
    }),
  });
  return applyAuthSession(data);
}

export async function loginUser(input: LoginInput): Promise<AuthUser> {
  const data = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
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
    body.password = input.password;
  }
  if (input.membershipId !== undefined) body.membershipId = input.membershipId;
  if (input.billingInterval !== undefined && input.billingInterval !== null) {
    body.billingInterval = input.billingInterval;
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

function extractId(value: unknown): string {
  if (typeof value === "string" && value) return value;
  if (isRecord(value)) {
    if (typeof value.id === "string" && value.id) return value.id;
    if (value._id != null) return String(value._id);
  }
  return "";
}

function asIsoString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeRole(raw: unknown): AppRole | undefined {
  if (!isRecord(raw)) return undefined;
  const id = extractId(raw);
  if (!id) return undefined;
  return {
    id,
    name: typeof raw.name === "string" ? raw.name : "",
    description:
      typeof raw.description === "string" ? raw.description : null,
  };
}

function normalizeAdminUser(raw: unknown): AdminUser {
  const record = isRecord(raw) ? raw : {};
  const role = normalizeRole(record.role);
  const membership = isRecord(record.membership)
    ? normalizeMembershipRecord(record.membership)
    : undefined;

  const billing =
    record.billingInterval === "yearly"
      ? "yearly"
      : record.billingInterval === "monthly"
        ? "monthly"
        : null;

  return {
    id: extractId(record.id ?? record._id),
    name: typeof record.name === "string" ? record.name : "",
    email: typeof record.email === "string" ? record.email : "",
    roleId: extractId(record.roleId) || role?.id || "",
    membershipId: extractId(record.membershipId) || membership?.id || "",
    billingInterval: billing,
    role: role ? { id: role.id, name: role.name } : undefined,
    membership,
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
  };
}

function normalizeMembershipRecord(raw: unknown): Membership {
  const record = isRecord(raw) ? raw : {};
  return {
    id: extractId(record.id ?? record._id),
    name: typeof record.name === "string" ? record.name : "",
    type: record.type === "paid" ? "paid" : "free",
    description:
      typeof record.description === "string" ? record.description : null,
    monthlyPrice: Number(record.monthlyPrice ?? 0),
    yearlyPrice: Number(record.yearlyPrice ?? 0),
  };
}

function normalizeCategory(raw: unknown): ApiCategory {
  const record = isRecord(raw) ? raw : {};
  return {
    id: extractId(record.id ?? record._id),
    name: typeof record.name === "string" ? record.name : "",
    type: record.type === "income" ? "income" : "expense",
    icon: typeof record.icon === "string" ? record.icon : "",
  };
}

function normalizeTransactionType(raw: unknown): ApiTransactionType {
  const record = isRecord(raw) ? raw : {};
  return {
    id: extractId(record.id ?? record._id),
    name: typeof record.name === "string" ? record.name : "",
    label: typeof record.label === "string" ? record.label : "",
    icon: typeof record.icon === "string" ? record.icon : "",
  };
}

type RawTransaction = {
  id: string;
  amount: number;
  description: string | null;
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
    description: typeof raw.description === "string" ? raw.description : null,
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

export async function fetchMemberships(
  type?: MembershipType,
): Promise<Membership[]> {
  const params = type ? `?type=${type}` : "";
  const data = await request<unknown[]>(`/memberships${params}`);
  return data.map(normalizeMembershipRecord);
}

export async function updateMembership(
  membershipId: string,
  billingInterval?: BillingInterval,
): Promise<AuthUser> {
  return updateProfile({ membershipId, billingInterval });
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const data = await request<unknown[]>("/users");
  return data.map(normalizeAdminUser);
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  const body: Record<string, string> = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
  if (input.roleId) body.roleId = input.roleId;
  if (input.membershipId) body.membershipId = input.membershipId;
  if (input.billingInterval) body.billingInterval = input.billingInterval;

  const data = await request<unknown>("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeAdminUser(data);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<AdminUser> {
  const body: Record<string, string> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.email !== undefined) body.email = input.email.trim().toLowerCase();
  if (input.password !== undefined) {
    body.password = input.password;
  }
  if (input.roleId !== undefined) body.roleId = input.roleId;
  if (input.membershipId !== undefined) body.membershipId = input.membershipId;
  if (input.billingInterval !== undefined && input.billingInterval !== null) {
    body.billingInterval = input.billingInterval;
  }

  const data = await request<unknown>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return normalizeAdminUser(data);
}

export async function deleteUser(id: string): Promise<void> {
  await request<void>(`/users/${id}`, { method: "DELETE" });
}

export async function fetchRoles(): Promise<AppRole[]> {
  const data = await request<unknown[]>("/roles");
  return data
    .map(normalizeRole)
    .filter((role): role is AppRole => Boolean(role));
}

export async function createRole(input: RoleInput): Promise<AppRole> {
  const data = await request<unknown>("/roles", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
    }),
  });
  const role = normalizeRole(data);
  if (!role) throw new Error("Failed to create role");
  return role;
}

export async function updateRole(
  id: string,
  input: RoleInput,
): Promise<AppRole> {
  const data = await request<unknown>(`/roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: input.name.trim(),
      description: input.description?.trim() || null,
    }),
  });
  const role = normalizeRole(data);
  if (!role) throw new Error("Failed to update role");
  return role;
}

export async function deleteRole(id: string): Promise<void> {
  await request<void>(`/roles/${id}`, { method: "DELETE" });
}

export async function createMembershipPlan(
  input: MembershipPlanInput,
): Promise<Membership> {
  const data = await request<unknown>("/memberships", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      type: input.type,
      description: input.description?.trim() || undefined,
      monthlyPrice: input.monthlyPrice ?? 0,
      yearlyPrice: input.yearlyPrice ?? 0,
    }),
  });
  return normalizeMembershipRecord(data);
}

export async function updateMembershipPlan(
  id: string,
  input: Partial<MembershipPlanInput>,
): Promise<Membership> {
  const body: Record<string, string | number | null> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.type !== undefined) body.type = input.type;
  if (input.description !== undefined) {
    body.description = input.description?.trim() || null;
  }
  if (input.monthlyPrice !== undefined) body.monthlyPrice = input.monthlyPrice;
  if (input.yearlyPrice !== undefined) body.yearlyPrice = input.yearlyPrice;

  const data = await request<unknown>(`/memberships/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return normalizeMembershipRecord(data);
}

export async function deleteMembershipPlan(id: string): Promise<void> {
  await request<void>(`/memberships/${id}`, { method: "DELETE" });
}

export async function createCategory(
  input: CategoryInput,
): Promise<ApiCategory> {
  const data = await request<unknown>("/categories", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      type: input.type,
      icon: input.icon?.trim() || undefined,
    }),
  });
  return normalizeCategory(data);
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
): Promise<ApiCategory> {
  const body: Record<string, string> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.type !== undefined) body.type = input.type;
  if (input.icon !== undefined) body.icon = input.icon.trim();

  const data = await request<unknown>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return normalizeCategory(data);
}

export async function deleteCategory(id: string): Promise<void> {
  await request<void>(`/categories/${id}`, { method: "DELETE" });
}

export async function createTransactionType(
  input: TransactionTypeInput,
): Promise<ApiTransactionType> {
  const data = await request<unknown>("/transaction-types", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      label: input.label.trim(),
      icon: input.icon?.trim() || undefined,
    }),
  });
  return normalizeTransactionType(data);
}

export async function updateTransactionType(
  id: string,
  input: Partial<TransactionTypeInput>,
): Promise<ApiTransactionType> {
  const body: Record<string, string> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.label !== undefined) body.label = input.label.trim();
  if (input.icon !== undefined) body.icon = input.icon.trim();

  const data = await request<unknown>(`/transaction-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return normalizeTransactionType(data);
}

export async function deleteTransactionType(id: string): Promise<void> {
  await request<void>(`/transaction-types/${id}`, { method: "DELETE" });
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
    const desc = `"${(t.description ?? "").replace(/"/g, '""')}"`;
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
      description:
        typeof record.description === "string"
          ? record.description.trim() || null
          : null,
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
      description: cleanDescription.trim() || null,
      category,
      date: toCalendarDate(date),
    };
  });
}
