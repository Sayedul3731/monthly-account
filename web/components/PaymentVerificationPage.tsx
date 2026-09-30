"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchMe,
  fetchMyManualPayments,
  logoutUser,
  type ManualPayment,
} from "@/lib/api";
import {
  clearAuthSession,
  getAccessToken,
  isAdmin,
  type AuthUser,
} from "@/lib/auth";
import { formatCurrency } from "@/lib/finance";
import AppHeader from "./AppHeader";
import LoadingState from "./LoadingState";
import { ChevronLeft } from "./icons";

function formatDate(value?: string): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function intervalLabel(value: ManualPayment["billingInterval"]): string {
  return value === "quarterly"
    ? "Quarterly"
    : value === "yearly"
      ? "Yearly"
      : "Monthly";
}

function statusMeta(status: ManualPayment["status"]) {
  if (status === "approved") {
    return { label: "Verified", className: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900" };
  }
  if (status === "rejected") {
    return { label: "Rejected", className: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900" };
  }
  return { label: "Awaiting review", className: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-900" };
}

export default function PaymentVerificationPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    void Promise.all([fetchMe(), fetchMyManualPayments()])
      .then(([account, history]) => {
        if (!cancelled) {
          setUser(account);
          setPayments(history);
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : "Unable to load payment history";
        if (/unauthorized|401|token/i.test(message)) {
          clearAuthSession();
          router.replace("/login");
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logoutUser();
    } finally {
      router.replace("/login");
    }
  }

  if (loading) return <LoadingState label="Loading payment verification" />;

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <AppHeader
        signedIn
        user={user ?? undefined}
        isAdmin={isAdmin(user)}
        signingOut={signingOut}
        onSignOut={() => void handleSignOut()}
      />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/membership" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300">
          <ChevronLeft /> Back to membership
        </Link>

        <section className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800 sm:px-7">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Payment verification</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Your submitted Nagad payments and their review status.</p>
          </div>

          <div className="p-5 sm:p-7">
            {error ? (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>
            ) : payments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700"><p className="font-semibold text-zinc-900 dark:text-white">No payment submissions yet</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Choose a Premium plan when you are ready, then submit the Nagad transaction ID for verification.</p><Link href="/membership" className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">View Premium options</Link></div>
            ) : (
              <ol className="space-y-4">
                {payments.map((payment) => {
                  const status = statusMeta(payment.status);
                  return <li key={payment.id} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-950/30">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-zinc-900 dark:text-white">{payment.membership?.name || "Premium"} · {intervalLabel(payment.billingInterval)}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${status.className}`}>{status.label}</span></div><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Transaction ID <span className="font-mono font-semibold">{payment.transactionId}</span></p><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Submitted {formatDate(payment.createdAt)}</p></div><p className="text-lg font-semibold text-zinc-900 dark:text-white">{formatCurrency(payment.amount)}</p></div>
                    {payment.status === "approved" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100"><span className="block text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Access starts</span>{formatDate(payment.planStartedAt)}</div><div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100"><span className="block text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Access ends</span>{formatDate(payment.planEndsAt)}</div></div>}
                    {payment.reviewNote && <p className="mt-4 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"><span className="font-semibold">Admin note: </span>{payment.reviewNote}</p>}
                  </li>;
                })}
              </ol>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
