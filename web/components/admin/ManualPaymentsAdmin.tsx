"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchManualPayments, type ManualPayment } from "@/lib/api";
import { formatCurrency } from "@/lib/finance";
import { ChevronRight, SpinnerIcon } from "../icons";
import { AdminEmpty, formatShortDate, titleCase } from "./ui";

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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ManualPayment["status"]>("all");

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

  if (loading) {
    return <div className="flex min-h-[20vh] items-center justify-center"><SpinnerIcon className="animate-spin" /></div>;
  }

  const pendingCount = payments.filter((payment) => payment.status === "pending").length;
  const filters: Array<{ id: "all" | ManualPayment["status"]; label: string; count: number }> = [
    { id: "all", label: "All", count: payments.length },
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "approved", label: "Approved", count: payments.filter((payment) => payment.status === "approved").length },
    { id: "rejected", label: "Rejected", count: payments.filter((payment) => payment.status === "rejected").length },
  ];
  const visiblePayments = filter === "all"
    ? payments
    : payments.filter((payment) => payment.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Payment reviews</h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Open a payment to verify its Nagad transaction ID and make a decision.</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">{pendingCount} awaiting review</span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-800 sm:px-5">
          <nav aria-label="Payment status filters" className="flex gap-1 overflow-x-auto">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  filter === item.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {item.label} <span className={filter === item.id ? "text-emerald-100" : "text-zinc-400 dark:text-zinc-500"}>({item.count})</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Transaction ID</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Starts</th>
                <th className="px-5 py-3">Ends</th>
                <th className="px-5 py-3">Submitted</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" aria-label="View payment" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {visiblePayments.length === 0 ? (
                <AdminEmpty>{filter === "all" ? "No manual payment submissions yet." : `No ${filter} payments.`}</AdminEmpty>
              ) : (
                visiblePayments.map((payment) => (
                  <tr key={payment.id} className="group transition hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10">
                    <td className="px-5 py-4">
                      <Link href={`/admin/payments/${payment.id}`} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                        <p className="font-semibold text-zinc-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">{payment.user?.name || "Deleted user"}</p>
                        <p className="mt-0.5 max-w-48 truncate text-xs text-zinc-500 dark:text-zinc-400">{payment.user?.email || "No email available"}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                      <p className="font-medium">{payment.membership?.name || "Unavailable plan"}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{titleCase(payment.billingInterval)}</p>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">{payment.transactionId}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-zinc-900 dark:text-white">{formatCurrency(payment.amount)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-600 dark:text-zinc-400">{formatShortDate(payment.planStartedAt)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-600 dark:text-zinc-400">{formatShortDate(payment.planEndsAt)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-600 dark:text-zinc-400">{formatShortDate(payment.createdAt)}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(payment.status)}`}>{titleCase(payment.status)}</span></td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/admin/payments/${payment.id}`} aria-label={`View payment ${payment.transactionId}`} className="inline-flex rounded-lg p-2 text-zinc-400 transition hover:bg-emerald-100 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300"><ChevronRight /></Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
