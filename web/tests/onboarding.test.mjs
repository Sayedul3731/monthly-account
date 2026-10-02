import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const { transpileModule, ModuleKind } = ts;
const testDirectory = dirname(fileURLToPath(import.meta.url));

// Exercise the TypeScript auth helpers with Node's test runner and the existing
// compiler dependency, including the session persisted between page loads.
function moduleFixture(name = "auth", overrides = {}) {
  const values = new Map();
  const modules = new Map();
  function load(moduleName) {
    if (modules.has(moduleName)) return modules.get(moduleName);
    const exports = {};
    modules.set(moduleName, exports);
    const source = readFileSync(
      resolve(testDirectory, `../lib/${moduleName}.ts`),
      "utf8",
    );
    const compiled = transpileModule(source, {
      compilerOptions: { module: ModuleKind.CommonJS },
    });
    runInNewContext(compiled.outputText, {
      exports,
      require: (specifier) => {
        assert.ok(
          specifier.startsWith("./"),
          `Unexpected dependency: ${specifier}`,
        );
        return load(specifier.slice(2));
      },
      Error,
      TypeError,
      URLSearchParams,
      process: { env: { NEXT_PUBLIC_API_URL: "http://localhost:3001" } },
      window: {},
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      },
      ...overrides,
    });
    return exports;
  }
  return load(name);
}

const authFixture = () => moduleFixture();
const user = { id: "member", name: "Sam", email: "sam@example.com" };

test("new and returning users with unfinished setup go to onboarding", () => {
  const auth = authFixture();
  for (const onboardingStep of [0, 1, 2, 3, 4]) {
    assert.equal(
      auth.signedInDestination({
        ...user,
        onboardingStatus: "pending",
        onboardingStep,
      }),
      "/onboarding",
    );
  }
});

test("legacy, completed, skipped, and admin accounts go to the dashboard", () => {
  const auth = authFixture();
  for (const onboardingStatus of [undefined, "completed", "skipped"]) {
    assert.equal(auth.signedInDestination({ ...user, onboardingStatus }), "/");
  }
  assert.equal(
    auth.signedInDestination({
      ...user,
      onboardingStatus: "pending",
      role: { id: "admin", name: "admin" },
    }),
    "/",
  );
  assert.equal(auth.needsOnboarding(null), false);
});

test("saved progress resumes and completing or skipping removes the redirect", () => {
  const auth = authFixture();
  auth.setAuthSession(
    { ...user, onboardingStatus: "pending", onboardingStep: 1 },
    "csrf",
  );
  assert.equal(auth.getStoredUser().onboardingStep, 1);
  assert.equal(auth.signedInDestination(auth.getStoredUser()), "/onboarding");
  for (const onboardingStatus of ["completed", "skipped"]) {
    auth.updateStoredUser({ ...user, onboardingStatus, onboardingStep: 2 });
    assert.equal(auth.signedInDestination(auth.getStoredUser()), "/");
  }
  auth.clearAuthSession();
  assert.equal(auth.getStoredUser(), null);
});

test("amounts accept Bengali and English digits, grouping, and two decimals", () => {
  const { parseOnboardingAmount } = moduleFixture("onboarding");
  for (const [input, expected] of [
    ["৩০,০০০", 30000],
    ["30,000", 30000],
    ["৫০০.৫০", 500.5],
    [" 500.50 ", 500.5],
    ["0.01", 0.01],
  ]) {
    assert.equal(parseOnboardingAmount(input), expected);
  }
  for (const input of [
    "",
    "0",
    "-1",
    "abc",
    "Infinity",
    "1e3",
    "500.123",
    "0.001",
    "99999999999999999999",
  ]) {
    assert.equal(parseOnboardingAmount(input), null, input);
  }
});

test("the first session shows the user's actual budget, spending, and remaining amount", () => {
  const { summarizeOnboarding } = moduleFixture("onboarding");
  const totals = summarizeOnboarding(
    [
      { type: "income", amount: 40000 },
      { type: "expense", amount: 500 },
    ],
    [{ category: "", amount: 30000 }],
  );
  assert.equal(totals.income, 40000);
  assert.equal(totals.budget, 30000);
  assert.equal(totals.spent, 500);
  assert.equal(totals.remaining, 29500);
});

test("summary includes other expenses and computes currency in cents", () => {
  const { summarizeOnboarding } = moduleFixture("onboarding");
  const totals = summarizeOnboarding(
    [
      { type: "expense", amount: 0.1 },
      { type: "expense", amount: 0.2 },
    ],
    [
      { category: "", amount: 1 },
      { category: "Food", amount: 50 },
    ],
  );
  assert.equal(totals.spent, 0.3);
  assert.equal(totals.remaining, 0.7);
  assert.equal(totals.budget, 1);
});

test("skipped budgets stay unset and overspending remains negative", () => {
  const { summarizeOnboarding } = moduleFixture("onboarding");
  assert.equal(
    summarizeOnboarding([{ type: "expense", amount: 500 }], []).remaining,
    null,
  );
  assert.equal(
    summarizeOnboarding(
      [{ type: "expense", amount: 500 }],
      [{ category: "", amount: 300 }],
    ).remaining,
    -200,
  );
});

test("resuming setup in a later month keeps entries in the setup month", () => {
  const { onboardingDate } = moduleFixture("onboarding");
  assert.equal(onboardingDate("2026-10", "2026-10-02"), "2026-10-02");
  assert.equal(onboardingDate("2026-10", "2026-11-02"), "2026-10-01");
  const auth = authFixture();
  auth.setAuthSession(
    {
      ...user,
      onboardingStatus: "pending",
      onboardingStep: 3,
      onboardingPeriod: "2026-10",
    },
    "csrf",
  );
  assert.equal(auth.getStoredUser().onboardingPeriod, "2026-10");
});

test("income saving uses PUT and reports server errors without blaming connectivity", async () => {
  const calls = [];
  const api = moduleFixture("api", {
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          message: "Choose a valid date in the month being set up.",
        }),
        { status: 400 },
      );
    },
  });
  const { onboardingErrorMessage } = moduleFixture("onboarding");
  await assert.rejects(
    api.saveOnboardingEntry("income", {
      transactionTypeId: "income",
      categoryId: "salary",
      amount: 30000,
      description: null,
      date: "2026-10-02",
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.kind, "http");
      assert.equal(
        onboardingErrorMessage(error, true),
        "যে মাসের হিসাব তৈরি করছেন, সেই মাসের একটি সঠিক তারিখ বেছে নিন।",
      );
      return true;
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "http://localhost:3001/transactions/onboarding/income",
  );
  assert.equal(calls[0].init.method, "PUT");
});

test("unreachable API and offline device get distinct error messages", async () => {
  const api = moduleFixture("api", {
    fetch: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  const { onboardingErrorMessage } = moduleFixture("onboarding");
  await assert.rejects(api.saveOnboardingEntry("income", {}), (error) => {
    assert.equal(error.kind, "network");
    assert.equal(
      onboardingErrorMessage(error, true),
      "অ্যাপের সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    );
    assert.equal(
      onboardingErrorMessage(error, false),
      "আপনি অফলাইনে আছেন। ইন্টারনেট সংযোগ ফিরলে আবার চেষ্টা করুন।",
    );
    return true;
  });
});

test("authentication, CSRF, and server failures retain their own explanations", () => {
  const { onboardingErrorMessage } = moduleFixture("onboarding");
  assert.equal(
    onboardingErrorMessage({ status: 401 }, true),
    "সেশনের মেয়াদ শেষ হয়েছে। আবার সাইন ইন করুন।",
  );
  assert.equal(
    onboardingErrorMessage(
      { status: 403, message: "Invalid CSRF token" },
      true,
    ),
    "সেশনের নিরাপত্তা তথ্য মেলেনি। পাতাটি রিফ্রেশ করে আবার চেষ্টা করুন।",
  );
  assert.equal(
    onboardingErrorMessage({ status: 500 }, true),
    "সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
  );
});
