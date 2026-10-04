import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const user = { id: "alice", name: "Alice", email: "alice@example.com", role: { id: "user-role", name: "user" }, onboardingStatus: "completed", trialEndsAt: "2099-01-01T00:00:00.000Z" };

async function mockApi(page: Page, transactions: Record<string, unknown>[] = [], account = user) {
  const requests: { path: string; method: string; body: Record<string, unknown> | null }[] = [];
  let categories = [
    { id: "shared", userId: null as string | null, name: "Food", type: "expense", icon: "🍎" },
    { id: "private", userId: "alice", name: "Pet care", type: "expense", icon: "🐾" },
  ];
  const budgets: Record<string, unknown>[] = [];
  let transactionTypes = [
    { id: "income-type", name: "income", label: "Income", icon: "💰" },
    { id: "expense-type", name: "expense", label: "Expense", icon: "💸" },
    { id: "custom-type", name: "custom", label: "Custom", icon: "📌" },
  ];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["fetch", "xhr"].includes(request.resourceType())) return route.continue();
    if (!url.pathname.startsWith("/api/") && url.port !== "3001") return route.continue();
    const path = url.pathname.replace(/^\/api/, "");
    const body = request.postData() ? request.postDataJSON() as Record<string, unknown> : null;
    requests.push({ path, method: request.method(), body });
    let json: unknown = [];
    let status = 200;
    if (path === "/auth/login" || path === "/auth/refresh") json = { user: account, csrfToken: "mock-csrf" };
    else if (path === "/auth/me") json = account;
    else if (path === "/auth/forgot-password") { status = 202; json = { message: "If an account with a password exists, a reset link will be emailed to you." }; }
    else if (path === "/auth/reset-password") { status = 204; json = undefined; }
    else if (path === "/categories/mine" || path === "/categories") json = categories;
    else if (path.startsWith("/categories/mine/") && request.method() === "PATCH") {
      const id = path.split("/").at(-1);
      categories = categories.map((category) => category.id === id ? { ...category, ...body } : category);
      json = categories.find((category) => category.id === id);
    } else if (path.startsWith("/categories/mine/") && request.method() === "DELETE") {
      categories = categories.filter((category) => category.id !== path.split("/").at(-1));
      status = 204; json = undefined;
    } else if (path === "/dashboard") json = { transactions, budgets, unreadNotificationCount: 0 };
    else if (path === "/budgets" && request.method() === "POST") { json = { id: "new-budget", ...body }; budgets.push(json as Record<string, unknown>); status = 201; }
    else if (path === "/transaction-types") json = transactionTypes;
    else if (path.startsWith("/transaction-types/") && request.method() === "PATCH") {
      const id = path.split("/").at(-1);
      transactionTypes = transactionTypes.map((type) => type.id === id ? { ...type, ...body } : type);
      json = transactionTypes.find((type) => type.id === id);
    } else if (path.startsWith("/transaction-types/") && request.method() === "DELETE") {
      transactionTypes = transactionTypes.filter((type) => type.id !== path.split("/").at(-1));
      status = 204; json = undefined;
    }
    else if (path === "/notifications") json = { items: [], unreadCount: 0 };
    await route.fulfill({ status, contentType: "application/json", body: status === 204 ? "" : JSON.stringify(json), headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:3100", "Access-Control-Allow-Credentials": "true" } });
  });
  return requests;
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("alice@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("password recovery is accessible and sends a generic confirmation", async ({ page }) => {
  const requests = await mockApi(page);
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("alice@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account with a password exists");
  expect(requests.find((request) => request.path === "/auth/forgot-password")?.body).toEqual({ email: "alice@example.com" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("password reset limits input, checks confirmation, and removes its token from the URL", async ({ page }) => {
  const requests = await mockApi(page);
  const token = "a".repeat(64);
  await page.goto(`/reset-password?token=${token}`);
  await expect(page).toHaveURL(/\/reset-password$/);
  const password = page.getByLabel("New password", { exact: true });
  await expect(password).toHaveAttribute("maxlength", "64");
  await password.fill("new-password-123");
  await page.getByLabel("Confirm password").fill("different-password");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "same password twice" })).toBeVisible();
  await page.getByLabel("Confirm password").fill("new-password-123");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?passwordChanged=1$/);
  expect(requests.find((request) => request.path === "/auth/reset-password")?.body).toEqual({ token, password: "new-password-123" });
});

test("personal category management leaves shared categories read-only", async ({ page }) => {
  const requests = await mockApi(page);
  await page.goto("/categories");
  const shared = page.getByRole("listitem").filter({ hasText: "Food" });
  await expect(shared).toContainText("Shared");
  await expect(shared.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  const own = page.getByRole("listitem").filter({ hasText: "Pet care" });
  await own.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Vet visits");
  await page.getByRole("button", { name: "Save category" }).click();
  const renamed = page.getByRole("listitem").filter({ hasText: "Vet visits" });
  await renamed.getByRole("button", { name: "Delete", exact: true }).click();
  await renamed.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Vet visits", { exact: false })).toHaveCount(0);
  expect(requests.some((request) => request.path === "/categories/mine/private" && request.method === "DELETE")).toBe(true);
});

test("custom categories appear in budget allocation on desktop and mobile", async ({ page }) => {
  const requests = await mockApi(page);
  await signIn(page);
  await page.getByRole("button", { name: "Budgets", exact: true }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Pet care" });
  await expect(row).toBeVisible();
  await row.getByRole("spinbutton").fill("500");
  await row.getByRole("button", { name: "Set", exact: true }).click();
  await expect.poll(() => requests.find((request) => request.path === "/budgets" && request.method === "POST")?.body?.category).toBe("Pet care");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Bengali category and description text render into a downloadable PDF", async ({ page }) => {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-04`;
  await mockApi(page, [{ id: "bengali-expense", type: "expense", amount: 125, category: { id: "private", name: "বাজার", icon: "🍎" }, description: "মাসের বাজার ও ওষুধ", date }]);
  await signIn(page);
  await page.getByRole("button", { name: "Budgets", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download budget PDF" }).click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/^monthly-statement-.*\.pdf$/);
  const contents = await readFile((await download.path())!);
  expect(contents.subarray(0, 5).toString()).toBe("%PDF-");
  expect(contents.toString("latin1")).toContain("/Subtype /Image");
});

test("admin can edit built-in labels while type names and deletion stay protected", async ({ page }) => {
  const requests = await mockApi(page, [], { ...user, role: { id: "admin-role", name: "admin" } });
  await signIn(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Types", exact: true }).click();
  const income = page.getByRole("row").filter({ hasText: "Income" });
  const expense = page.getByRole("row").filter({ hasText: "Expense" });
  await expect(income.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await expect(expense.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  await income.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute("readonly", "");
  await expect(page.getByText("This built-in name cannot be changed. Update the label instead.")).toBeVisible();
  await page.getByLabel("Label", { exact: true }).fill("Monthly earnings");
  await page.getByRole("button", { name: "Save type", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Monthly earnings" })).toBeVisible();
  const update = requests.find((request) => request.path === "/transaction-types/income-type" && request.method === "PATCH");
  expect(update?.body).toEqual({ label: "Monthly earnings", icon: "💰" });
  const custom = page.getByRole("row").filter({ hasText: "Custom" });
  await expect(custom.getByRole("button", { name: "Delete", exact: true })).toHaveCount(1);
  await custom.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeEditable();
});
