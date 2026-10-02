import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const now = Date.parse("2026-10-02T06:00:00Z");
const past = "2026-10-01T06:00:00Z";
const future = "2099-10-03T06:00:00Z";
const user = { id: "member", name: "Sam", email: "sam@example.com" };
const trial = { id: "trial-plan", name: "Free", type: "free" };
const premium = {
  id: "premium-plan", name: "Premium", type: "paid",
  monthlyPrice: 100, quarterlyPrice: 250, yearlyPrice: 900,
};

function loadSource(path, dependencies = {}) {
  const source = readFileSync(resolve(testDirectory, path), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports,
    Date: class extends Date {
      static now() { return now; }
    },
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const statusModule = loadSource("../lib/membership-status.ts");
const { subscriptionSummary } = statusModule;
const checkoutStatusModule = loadSource("../lib/checkout-payment-status.ts", {
  "./membership-status": statusModule,
});

function renderCheckout(account, payments) {
  const state = [account, premium, { nagadNumber: "01800000000" }, payments, "", false, false, null, null, false];
  let stateIndex = 0;
  const icon = () => React.createElement("span", { "aria-hidden": true });
  const { default: Page } = loadSource("../components/CheckoutPage.tsx", {
    react: { ...React, useEffect: () => {}, useState: () => [state[stateIndex++], () => {}] },
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": {
      useRouter: () => ({ push: () => {}, replace: () => {} }),
      useSearchParams: () => new URLSearchParams({ plan: premium.id, interval: "monthly" }),
    },
    "@/lib/api": {},
    "@/lib/auth": { isAdmin: () => false },
    "@/lib/finance": { formatCurrency: (amount) => `Tk ${amount}` },
    "@/lib/membership-status": statusModule,
    "@/lib/checkout-payment-status": checkoutStatusModule,
    "./AppHeader": { default: () => null },
    "./LoadingState": { default: () => null },
    "./icons": { ChevronLeft: icon, SpinnerIcon: icon },
  });
  return renderToStaticMarkup(React.createElement(Page));
}

const approvedPayment = {
  id: "payment", membershipId: premium.id, billingInterval: "monthly",
  transactionId: "PREVIOUS123", status: "approved",
};

test("checkout separates an earlier monthly approval from the active quarterly membership", () => {
  const account = { ...user, membership: premium, billingInterval: "quarterly", planEndsAt: future };
  const html = renderCheckout(account, [{ ...approvedPayment, planEndsAt: future }]);
  assert.match(html, /Current membership: Premium active.*Quarterly/);
  assert.match(html, /Previous payment approved/);
  assert.match(html, /A new submission is a separate purchase/);
  assert.match(html, /Paid access ends:/);
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Submit for verification/);
});

test("checkout permits renewal after an earlier approved payment expires", () => {
  const html = renderCheckout({ ...user, membership: trial, trialEndsAt: past }, [
    { ...approvedPayment, planEndsAt: past },
  ]);
  assert.match(html, /Current membership: Trial ended/);
  assert.match(html, /Previous payment approved/);
  assert.match(html, /access period has ended/);
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Submit for verification/);
});

test("checkout blocks another payment when approval has not activated Premium", () => {
  for (const planEndsAt of [undefined, future]) {
    const html = renderCheckout({ ...user, membership: trial, trialEndsAt: past }, [
      { ...approvedPayment, planEndsAt },
    ]);
    assert.match(html, /Current membership: Trial ended/);
    assert.match(html, /Contact the administrator before sending another payment/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>Submit for verification/);
  }
});

test("checkout never shows another billing interval's approval for a new monthly purchase", () => {
  const html = renderCheckout({ ...user, trialEndsAt: past }, [
    { ...approvedPayment, billingInterval: "quarterly", planEndsAt: past },
  ]);
  assert.doesNotMatch(html, /Previous payment approved|PREVIOUS123/);
});

test("a pending payment for any interval blocks duplicate submissions", () => {
  const html = renderCheckout({ ...user, trialEndsAt: past }, [
    { ...approvedPayment, status: "pending", billingInterval: "quarterly" },
  ]);
  assert.match(html, /A payment is already awaiting review/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Submit for verification/);
});

// Render the actual page with loaded API state, without browser sessions or
// network access. The fixture catches conflicting summary/card states.
function renderMembership(account) {
  const state = [account, [trial, premium], [], false, null, null, null, null, false, false, ""];
  let stateIndex = 0;
  const icon = () => React.createElement("span", { "aria-hidden": true });
  const { default: Page } = loadSource("../components/MembershipsPage.tsx", {
    react: { ...React, useEffect: () => {}, useState: () => [state[stateIndex++], () => {}] },
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { useRouter: () => ({ push: () => {}, replace: () => {} }) },
    "@/lib/api": {},
    "@/lib/auth": { isAdmin: () => false },
    "@/lib/finance": { formatCurrency: (amount) => `Tk ${amount}` },
    "@/lib/membership-status": statusModule,
    "./AppHeader": { default: () => null },
    "./LoadingState": { default: () => null },
    "./icons": { CheckIcon: icon, ChevronLeft: icon, SpinnerIcon: icon },
  });
  return renderToStaticMarkup(React.createElement(Page));
}

test("expired trials agree across summary and card even without matching plan IDs", () => {
  for (const membership of [undefined, { ...trial, id: "legacy-plan" }, trial]) {
    const account = { ...user, membership, trialEndsAt: past };
    const summary = subscriptionSummary(account, now);
    assert.equal(summary.status, "Trial ended");
    assert.equal(summary.expired, true);
    const html = renderMembership(account);
    assert.match(html, /Trial ended/);
    assert.match(html, /Upgrade to Premium to continue using প্রতিদিনের হিসাব/);
    assert.match(html, /href="#membership-plans"/);
    assert.match(html, /id="membership-plans"/);
    const trialCard = html.match(/<article\b[\s\S]*?<\/article>/)[0];
    assert.match(trialCard, /<button[^>]*disabled=""[^>]*>Trial used<\/button>/);
    assert.doesNotMatch(html, /Trial access|Action required:/);
  }
});

test("active trials remain current even when the account has no plan ID", () => {
  const account = { ...user, trialEndsAt: future };
  assert.equal(subscriptionSummary(account, now).status, "Trial active");
  const html = renderMembership(account);
  assert.match(html, /Current trial/);
  assert.doesNotMatch(html, /Trial used|Trial ended/);
  assert.doesNotMatch(html, /View Premium plans/);
});

test("trial expiry includes the exact end time and calculates remaining days", () => {
  const account = { ...user, trialEndsAt: "2026-10-03T06:00:00Z" };
  assert.match(subscriptionSummary(account, now).message, /1 day remaining/);
  assert.equal(subscriptionSummary(account, Date.parse(account.trialEndsAt)).status, "Trial ended");
});

test("unknown or invalid dates do not claim a trial has ended or is available", () => {
  for (const trialEndsAt of [undefined, "invalid-date"]) {
    const account = { ...user, trialEndsAt };
    const summary = subscriptionSummary(account, now);
    assert.equal(summary.status, "Access unavailable");
    assert.equal(summary.expired, false);
    const html = renderMembership(account);
    assert.match(html, /Trial unavailable/);
    assert.doesNotMatch(html, /Trial used|Trial ended|Current trial/);
  }
});

test("expired Premium members can renew their existing billing interval", () => {
  const account = { ...user, membership: premium, billingInterval: "monthly", planEndsAt: past, trialEndsAt: future };
  assert.equal(subscriptionSummary(account, now).status, "Premium expired");
  const html = renderMembership(account);
  assert.match(html, /Choose Monthly/);
  assert.doesNotMatch(html, /Current plan|15-day Trial|Trial access/);
  assert.equal((html.match(/<article\b/g) || []).length, 3);
});

test("active Premium members see their current plan without a trial offer", () => {
  const account = { ...user, membership: premium, billingInterval: "monthly", planEndsAt: future, trialEndsAt: past };
  assert.equal(subscriptionSummary(account, now).status, "Premium active");
  const html = renderMembership(account);
  assert.match(html, /Current plan/);
  assert.doesNotMatch(html, /Choose Monthly|15-day Trial|Trial used/);
});
