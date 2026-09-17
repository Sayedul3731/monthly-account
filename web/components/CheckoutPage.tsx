"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import {
  createManualPayment,
  fetchManualPaymentSettings,
  fetchMe,
  fetchMemberships,
  fetchMyManualPayments,
  logoutUser,
  type BillingInterval,
  type ManualPayment,
  type ManualPaymentSettings,
  type Membership,
} from "@/lib/api";
import {
  clearAuthSession,
  getAccessToken,
  isAdmin,
  type AuthUser,
} from "@/lib/auth";
import { formatCurrency } from "@/lib/finance";
import AppHeader from "./AppHeader";
import { ChevronLeft, SpinnerIcon } from "./icons";

const intervals: BillingInterval[] = ["monthly", "quarterly", "yearly"];

function isBillingInterval(value: string | null): value is BillingInterval {
  return intervals.includes(value as BillingInterval);
}

function intervalLabel(interval: BillingInterval): string {
  return interval === "quarterly"
    ? "Quarterly"
    : interval === "yearly"
      ? "Yearly"
      : "Monthly";
}

function intervalTerm(interval: BillingInterval): string {
  return interval === "quarterly"
    ? "3 months"
    : interval === "yearly"
      ? "12 months"
      : "1 month";
}

function intervalPrice(plan: Membership, interval: BillingInterval): number {
  if (interval === "quarterly") return plan.quarterlyPrice;
  if (interval === "yearly") return plan.yearlyPrice;
  return plan.monthlyPrice;
}

function paymentStatus(payment: ManualPayment): string {
  return payment.status === "approved"
    ? "Approved"
    : payment.status === "rejected"
      ? "Rejected"
      : "Awaiting review";
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");
  const interval = searchParams.get("interval");
  const invalidSelection = !planId || !isBillingInterval(interval);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [plan, setPlan] = useState<Membership | null>(null);
  const [settings, setSettings] = useState<ManualPaymentSettings | null>(null);
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    if (invalidSelection) return;

    let cancelled = false;
    (async () => {
      try {
        const [me, memberships, paymentSettings, myPayments] = await Promise.all([
          fetchMe(),
          fetchMemberships("paid"),
          fetchManualPaymentSettings(),
          fetchMyManualPayments(),
        ]);
        if (cancelled) return;
        const selectedPlan = memberships.find((entry) => entry.id === planId);
        if (!selectedPlan) {
          setError("That paid plan is no longer available.");
          return;
        }
        setUser(me);
        setPlan(selectedPlan);
        setSettings(paymentSettings);
        setPayments(myPayments);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load checkout";
        if (/unauthorized|401|token/i.test(message)) {
          clearAuthSession();
          router.replace("/login");
          return;
        }
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invalidSelection, planId, router]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logoutUser();
      router.push("/login");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan || !isBillingInterval(interval) || submitting) return;

    const normalizedId = transactionId.trim().toUpperCase();
    if (!/^[A-Z0-9-]{6,100}$/.test(normalizedId)) {
      setError("Enter the Nagad transaction ID using 6–100 letters, numbers, or hyphens.");
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const payment = await createManualPayment({
        membershipId: plan.id,
        billingInterval: interval,
        transactionId: normalizedId,
      });
      setPayments((current) => [payment, ...current]);
      setTransactionId("");
      setSuccess("Payment submitted. Your plan will activate after an admin verifies it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !invalidSelection) {
    return <div className="flex min-h-[60vh] items-center justify-center"><SpinnerIcon className="animate-spin" /></div>;
  }

  if (invalidSelection || (error && (!plan || !user)) || !plan || !user || !isBillingInterval(interval)) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
          {error ?? "Choose a paid plan before opening checkout."}
        </div>
        <Link href="/membership" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
          <ChevronLeft /> Back to plans
        </Link>
      </div>
    );
  }

  const price = intervalPrice(plan, interval);
  const pendingPayment = payments.find((payment) => payment.status === "pending");
  const latestForSelection = payments.find(
    (payment) => payment.membershipId === plan.id && payment.billingInterval === interval,
  );
  const canSubmit = Boolean(settings?.nagadNumber) && !pendingPayment;

  return (
    <div className="relative min-h-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.1),transparent)]" />
      <div className="relative">
        <AppHeader signedIn user={{ name: user.name, email: user.email }} isAdmin={isAdmin(user)} signingOut={signingOut} onSignOut={handleSignOut} />
        <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
          <Link href="/membership" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
            <ChevronLeft /> Back to plans
          </Link>
          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white dark:border-zinc-800 sm:px-8">
              <p className="text-sm font-medium text-emerald-100">Nagad checkout</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pay and submit your transaction ID</h1>
            </div>
            <div className="space-y-6 p-6 sm:p-8">
              <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{plan.name}</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{intervalLabel(interval)} access · {intervalTerm(interval)}</p>
                  </div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">{formatCurrency(price)}</p>
                </div>
              </div>

              {!settings?.nagadNumber ? (
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100">
                  <p className="font-semibold">Manual payment is not ready yet.</p>
                  <p className="mt-1 leading-6">The Nagad number has not been configured. Please contact the administrator before sending money.</p>
                </div>
              ) : (
                <section aria-labelledby="payment-instructions">
                  <h2 id="payment-instructions" className="text-base font-semibold text-zinc-900 dark:text-white">Payment instructions</h2>
                  <ol className="mt-3 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">1</span><span>Send exactly <strong>{formatCurrency(price)}</strong> by Nagad to this number:</span></li>
                    <li className="ml-9 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-mono text-base font-bold tracking-wide text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">{settings.nagadNumber}</li>
                    <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">2</span><span>Keep the Nagad confirmation. Do not use Cash Out; send payment to the number above.</span></li>
                    <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">3</span><span>Paste the transaction ID below. An administrator will verify it before your plan becomes active.</span></li>
                  </ol>
                </section>
              )}

              {latestForSelection && (
                <div className={`rounded-xl border p-4 text-sm ${latestForSelection.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : latestForSelection.status === "rejected" ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"}`}>
                  <p className="font-semibold">{paymentStatus(latestForSelection)}</p>
                  <p className="mt-1">Transaction ID: <span className="font-mono font-semibold">{latestForSelection.transactionId}</span></p>
                  {latestForSelection.reviewNote && <p className="mt-1">Admin note: {latestForSelection.reviewNote}</p>}
                </div>
              )}

              {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">{error}</div>}
              {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">{success}</div>}

              <form onSubmit={handleSubmit} className="space-y-3">
                <label htmlFor="transaction-id" className="block text-sm font-semibold text-zinc-900 dark:text-white">Nagad transaction ID</label>
                <input id="transaction-id" value={transactionId} onChange={(event) => setTransactionId(event.target.value.toUpperCase())} placeholder="Example: A1B2C3D4E5" maxLength={100} pattern="[A-Za-z0-9-]{6,100}" disabled={!canSubmit || submitting} required className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 font-mono text-sm text-zinc-900 outline-none transition placeholder:font-sans placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:disabled:bg-zinc-800" />
                {pendingPayment && <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">A payment is already awaiting review. You can submit another transaction only after an admin rejects or completes that review.</p>}
                <button type="submit" disabled={!canSubmit || submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {submitting ? <><SpinnerIcon className="animate-spin" /> Submitting…</> : "Submit for verification"}
                </button>
              </form>
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">Your plan is not activated when you submit this form. It is activated only after an administrator approves the payment.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><SpinnerIcon className="animate-spin" /></div>}><CheckoutContent /></Suspense>;
}
