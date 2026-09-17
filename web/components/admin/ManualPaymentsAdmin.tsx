"use client";

import { useEffect, useState } from "react";
import {
  fetchManualPayments,
  reviewManualPayment,
  type ManualPayment,
} from "@/lib/api";
import { formatCurrency } from "@/lib/finance";
import { SpinnerIcon } from "../icons";
import { AdminAlert, formatShortDate, titleCase } from "./ui";

type Props = {
  onError: (message: string) => void;
};

function statusClass(status: ManualPayment["status"]): string {
  if (status === "approved") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900";
  }
  if (status === "rejected") {
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900";
  }
  return "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900";
}

export default function ManualPaymentsAdmin({ onError }: Props) {
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchManualPayments();
        if (!cancelled) setPayments(result);
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : "Failed to load payments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onError]);

  async function handleReview(
    payment: ManualPayment,
    status: "approved" | "rejected",
  ) {
    if (reviewingId) return;
    const note = notes[payment.id]?.trim();
    if (status === "rejected" && !note) {
      onError("Add a rejection reason so the user knows what to correct.");
      return;
    }
    const message = status === "approved"
      ? `Approve ${payment.transactionId} and activate ${payment.user?.name || "this user"}'s plan?`
      : `Reject ${payment.transactionId}?`;
    if (!window.confirm(message)) return;

    setReviewingId(payment.id);
    setSuccess(null);
    try {
      const reviewed = await reviewManualPayment(payment.id, {
        status,
        reviewNote: note,
      });
      setPayments((current) =>
        current.map((entry) => (entry.id === reviewed.id ? reviewed : entry)),
      );
      setSuccess(
        status === "approved"
          ? `Approved ${payment.transactionId}; the user's membership is now active.`
          : `Rejected ${payment.transactionId}.`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to review payment");
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) {
    return <div className="flex min-h-[20vh] items-center justify-center"><SpinnerIcon className="animate-spin" /></div>;
  }

  const pendingCount = payments.filter((payment) => payment.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Payment reviews</h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Verify Nagad transaction IDs before activating a paid membership.</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">{pendingCount} awaiting review</span>
      </div>

      {success && <AdminAlert kind="success">{success}</AdminAlert>}

      {payments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">No manual payment submissions yet.</div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => {
            const isPending = payment.status === "pending";
            const reviewing = reviewingId === payment.id;
            return (
              <article key={payment.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-zinc-900 dark:text-white">{payment.user?.name || "Deleted user"}</h3>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(payment.status)}`}>{titleCase(payment.status)}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{payment.user?.email || "No email available"} · Submitted {formatShortDate(payment.createdAt)}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-sm font-bold text-zinc-900 dark:text-white">{payment.transactionId}</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(payment.amount)} · {titleCase(payment.billingInterval)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-800/70 sm:grid-cols-2">
                  <div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Plan</p><p className="mt-1 font-medium text-zinc-900 dark:text-white">{payment.membership?.name || "Plan no longer available"}</p></div>
                  <div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Payment method</p><p className="mt-1 font-medium text-zinc-900 dark:text-white">Nagad · BDT</p></div>
                </div>

                {isPending ? (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Review note <span className="font-normal text-zinc-400">(required only when rejecting)</span></label>
                    <textarea value={notes[payment.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [payment.id]: event.target.value }))} maxLength={500} rows={2} placeholder="For example: Transaction ID was not found in Nagad history." className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleReview(payment, "approved")} disabled={Boolean(reviewingId)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{reviewing ? <><SpinnerIcon className="animate-spin" /> Reviewing…</> : "Approve & activate"}</button>
                      <button type="button" onClick={() => handleReview(payment, "rejected")} disabled={Boolean(reviewingId)} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">Reject payment</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                    Reviewed {formatShortDate(payment.reviewedAt)}{payment.reviewedBy?.name ? ` by ${payment.reviewedBy.name}` : ""}.{payment.reviewNote ? ` Note: ${payment.reviewNote}` : ""}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
