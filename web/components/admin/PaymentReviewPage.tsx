"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchManualPayment,
  fetchMe,
  logoutUser,
  reviewManualPayment,
  type ManualPayment,
} from "@/lib/api";
import {
  clearAuthSession,
  getAccessToken,
  isAdmin,
  type AuthUser,
} from "@/lib/auth";
import { formatCurrency } from "@/lib/finance";
import { toast } from "sonner";
import AppHeader from "../AppHeader";
import { ChevronLeft, SpinnerIcon } from "../icons";
import { formatShortDate, titleCase } from "./ui";

function statusClass(status: ManualPayment["status"]): string {
  if (status === "approved") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900";
  }
  if (status === "rejected") {
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900";
  }
  return "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900";
}

export default function PaymentReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const paymentId = params.id;
  const invalidPaymentId = !paymentId;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [payment, setPayment] = useState<ManualPayment | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    if (invalidPaymentId) return;

    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (cancelled) return;
        if (!isAdmin(me)) {
          setForbidden(true);
          setUser(me);
          return;
        }
        const result = await fetchManualPayment(paymentId);
        if (cancelled) return;
        setUser(me);
        setPayment(result);
        setNote(result.reviewNote ?? "");
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load payment";
        if (/unauthorized|401|token/i.test(message)) {
          clearAuthSession();
          router.replace("/login");
          return;
        }
        if (/forbidden|403/i.test(message)) {
          setForbidden(true);
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
  }, [invalidPaymentId, paymentId, router]);

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

  async function submitReview(status: "approved" | "rejected") {
    if (!payment || saving) return;
    const reviewNote = note.trim();
    if (status === "rejected" && !reviewNote) {
      setError("Add a rejection reason so the customer knows what to correct.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await reviewManualPayment(payment.id, { status, reviewNote });
      setPayment(updated);
      setNote(updated.reviewNote ?? "");
      setSuccess(
        status === "approved"
          ? "Payment approved and membership activated."
          : "Payment rejected and the customer has been notified in their checkout view.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review payment");
    } finally {
      setSaving(false);
    }
  }

  function confirmReview(status: "approved" | "rejected") {
    if (!payment || saving) return;
    const approving = status === "approved";
    toast(approving ? "Approve this payment?" : "Reject this payment?", {
      description: approving
        ? `This activates ${payment.user?.name || "the user's"} ${payment.membership?.name || "paid"} plan.`
        : `The customer will see the rejection note in their membership status.`,
      duration: Infinity,
      action: {
        label: approving ? "Approve" : "Reject",
        onClick: () => void submitReview(status),
      },
      cancel: { label: "Cancel", onClick: () => undefined },
    });
  }

  if (loading && !invalidPaymentId) {
    return <div className="flex min-h-[60vh] items-center justify-center"><SpinnerIcon className="animate-spin" /></div>;
  }

  if (invalidPaymentId || forbidden || !user || !isAdmin(user) || error && !payment) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {forbidden ? "This page is limited to administrators." : error ?? "Payment not found."}
        </div>
        <Link href="/admin" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"><ChevronLeft /> Back to admin</Link>
      </main>
    );
  }

  if (!payment) return null;
  const pending = payment.status === "pending";

  return (
    <div className="relative min-h-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.1),transparent)]" />
      <div className="relative">
        <AppHeader signedIn user={{ name: user.name, email: user.email }} isAdmin signingOut={signingOut} onSignOut={handleSignOut} wide />
        <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"><ChevronLeft /> Back to payment reviews</Link>
          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/40 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Manual payment review</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">{payment.user?.name || "Deleted user"}</h1>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Submitted {formatShortDate(payment.createdAt)} · {payment.user?.email || "No email available"}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${statusClass(payment.status)}`}>{titleCase(payment.status)}</span>
              </div>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <section className="grid gap-4 rounded-xl bg-zinc-50 p-5 dark:bg-zinc-800/70 sm:grid-cols-2">
                <div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Plan</p><p className="mt-1 font-semibold text-zinc-900 dark:text-white">{payment.membership?.name || "Plan no longer available"}</p><p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{titleCase(payment.billingInterval)} billing</p></div>
                <div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Amount</p><p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(payment.amount)}</p><p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Nagad · BDT</p></div>
                <div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Plan starts</p><p className="mt-1 font-medium text-zinc-900 dark:text-white">{formatShortDate(payment.planStartedAt)}</p></div>
                <div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Plan ends</p><p className="mt-1 font-medium text-zinc-900 dark:text-white">{formatShortDate(payment.planEndsAt)}</p></div>
                <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Nagad transaction ID</p><p className="mt-1 break-all rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm font-bold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white">{payment.transactionId}</p></div>
              </section>

              {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">{error}</div>}
              {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">{success}</div>}

              {pending ? (
                <section>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Review decision</h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Confirm the transaction in your Nagad history before approving. Approval activates the paid plan immediately.</p>
                  <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); confirmReview("approved"); }}>
                    <label htmlFor="review-note" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Review note <span className="font-normal text-zinc-400">(required for rejection)</span></label>
                    <textarea id="review-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="For example: Transaction ID was not found in Nagad history." className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" />
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <><SpinnerIcon className="animate-spin" /> Saving…</> : "Approve & activate"}</button>
                      <button type="button" onClick={() => confirmReview("rejected")} disabled={saving} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">Reject payment</button>
                    </div>
                  </form>
                </section>
              ) : (
                <section className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                  <p className="font-semibold text-zinc-900 dark:text-white">Review completed</p>
                  <p className="mt-1">Reviewed {formatShortDate(payment.reviewedAt)}{payment.reviewedBy?.name ? ` by ${payment.reviewedBy.name}` : ""}.</p>
                  {payment.reviewNote && <p className="mt-2">Note: {payment.reviewNote}</p>}
                </section>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
