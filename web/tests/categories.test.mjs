import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function fixture(respond) {
  const calls = [];
  const exports = {};
  const source = readFileSync(
    new URL("../lib/api.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  runInNewContext(compiled.outputText, {
    exports,
    require: (name) => {
      if (name === "./auth") return { getCsrfToken: () => "category-csrf" };
      if (name === "./finance")
        return { CATEGORY_ICONS: {}, toCalendarDate: (date) => date };
      throw new Error(`Unexpected dependency ${name}`);
    },
    process: { env: { NEXT_PUBLIC_API_URL: "http://localhost:3001" } },
    URLSearchParams,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return respond(url, init);
    },
  });
  return { api: exports, calls };
}

test("personal creation uses the account endpoint, CSRF, trimmed input, and preserves ownership", async () => {
  const { api, calls } = fixture(() =>
    Response.json({
      _id: "pet-care",
      name: "Pet care",
      type: "expense",
      icon: "🐾",
      userId: "alice",
    }),
  );
  const category = await api.createPersonalCategory({
    name: " Pet care ",
    type: "expense",
    icon: " 🐾 ",
  });
  assert.equal(category.id, "pet-care");
  assert.equal(category.userId, "alice");
  assert.equal(calls[0].url, "http://localhost:3001/categories/mine");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers["X-CSRF-Token"], "category-csrf");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    name: "Pet care",
    type: "expense",
    icon: "🐾",
  });
});

test("account catalogs and admin catalogs use separate endpoints with type filters", async () => {
  const { api, calls } = fixture((url) =>
    Response.json(
      url.includes("/mine")
        ? [{ id: "own" }, { id: "shared" }]
        : [{ id: "shared" }],
    ),
  );
  assert.equal((await api.fetchCategories())[0].id, "own");
  await api.fetchCategories("income");
  assert.equal((await api.fetchSharedCategories()).length, 1);
  await api.fetchSharedCategories("expense");
  await api.createCategory({ name: "Shared new", type: "income" });
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "http://localhost:3001/categories/mine",
      "http://localhost:3001/categories/mine?type=income",
      "http://localhost:3001/categories",
      "http://localhost:3001/categories?type=expense",
      "http://localhost:3001/categories",
    ],
  );
});

test("personal-category duplicate errors retain the server explanation", async () => {
  const { api } = fixture(() =>
    Response.json({ message: "Category already exists" }, { status: 409 }),
  );
  await assert.rejects(
    api.createPersonalCategory({ name: "Food", type: "expense" }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, "Category already exists");
      return true;
    },
  );
});
