"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cancelMembership,
  fetchMe,
  fetchMemberships,
  fetchMyManualPayments,
  logoutUser,
  type BillingInterval,
  type ManualPayment,
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
import LoadingState from "./LoadingState";
import { CheckIcon, ChevronLeft, SpinnerIcon } from "./icons";

const FREE_FEATURES = [
  "Full Premium feature access",
  "No payment details required",
  "Ends automatically after 15 days",
];
const PREMIUM_FEATURES = [
  "Account Snapshot",
  "Transactions",
  "Spending Calendar",
  "Budget Tracking",
  "Categories",
];

function membershipLabel(membership?: AuthUser["membership"]): string {
  if (!membership?.name) return "Free";
  return membership.name;
}

function intervalLabel(interval?: BillingInterval | null): string {
  return interval === "quarterly"
    ? "quarterly"
    : interval === "yearly"
      ? "yearly"
      : "monthly";
}

function formatMembershipPrice(value: unknown): string {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? formatCurrency(price) : "—";
}

function formatPlanDateTime(value?: string): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Not available";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function subscriptionSummary(user: AuthUser) {
  const isPremium = user.membership?.type === "paid";
  const startsAt = isPremium ? user.planStartedAt : user.trialStartedAt;
  const endsAt = isPremium ? user.planEndsAt : user.trialEndsAt;
  const endDate = endsAt ? new Date(endsAt) : null;
  const active = Boolean(endDate && endDate > new Date());
  const daysRemaining = active && endDate
    ? Math.ceil((endDate.getTime() - Date.now()) / 86_400_000)
    : 0;

  return {
    active,
    startsAt,
    endsAt,
    planName: isPremium ? "Premium" : "15-day Trial",
    status: active
      ? isPremium ? "Premium active" : "Trial active"
      : isPremium ? "Premium expired" : "Trial ended",
    message: active
      ? isPremium
        ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} of Premium access remaining.`
        : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left in your free trial.`
      : "Choose a Premium billing option below to restore full access.",
  };
}

function paymentStatusClass(status: ManualPayment["status"]): string {
  if (status === "approved") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900";
  }
  if (status === "rejected") {
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900";
  }
  return "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900";
}

export default function MembershipsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [plans, setPlans] = useState<Membership[]>([]);
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switchingKey, setSwitchingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);
  const [cancellationConfirmation, setCancellationConfirmation] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [me, memberships, manualPayments] = await Promise.all([
          fetchMe(),
          fetchMemberships(),
          fetchMyManualPayments(),
        ]);
        if (cancelled) return;
        setUser(me);
        setPlans(memberships);
        setPayments(manualPayments);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load memberships";
        if (/unauthorized|401|token/i.test(message)) {
          clearAuthSession();
          router.replace("/login");
          return;
        }
        setLoadError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

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

  async function handleSelect(
    plan: Membership,
    billingInterval?: BillingInterval,
  ) {
    if (plan.type === "free" && user?.membership?.type === "paid") {
      openCancellationDialog();
      return;
    }

    if (plan.type === "paid" && billingInterval) {
      router.push(
        `/membership/checkout?plan=${encodeURIComponent(plan.id)}&interval=${billingInterval}`,
      );
    }
  }

  function openCancellationDialog() {
    setCancellationConfirmation("");
    setCancellationDialogOpen(true);
  }

  async function handleCancellation() {
    if (switchingKey || cancellationConfirmation !== "CANCEL") return;
    setActionError(null);
    setActionSuccess(null);
    setSwitchingKey("cancel-membership");
    try {
      const updated = await cancelMembership();
      setUser(updated);
      setCancellationDialogOpen(false);
      setCancellationConfirmation("");
      window.dispatchEvent(new Event("notifications:updated"));
      setActionSuccess(
        "Renewal cancellation confirmed. Premium access remains available until the end of your paid period.",
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to cancel membership",
      );
    } finally {
      setSwitchingKey(null);
    }
  }

  if (loading) {
    return <LoadingState label="Loading membership options" />;
  }

  if (loadError || !user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {loadError ?? "Unable to load memberships."}
        </div>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          <ChevronLeft />
          Back to account
        </Link>
      </div>
    );
  }

  const currentId = user.membership?.id;
  const isPaidMembership = user.membership?.type === "paid";
  const subscription = subscriptionSummary(user);

  return (
    <div className="relative min-h-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.1),transparent)]"
      />

      <div className="relative">
        <AppHeader
          signedIn
          user={user}
          isAdmin={isAdmin(user)}
          signingOut={signingOut}
          onSignOut={handleSignOut}
        />

        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-white">
            Membership
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Premium access with a billing schedule that works for you.
          </p>
        </div>

        <section className="mb-6 overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-sm sm:p-8">
          <p className="text-sm font-medium text-emerald-100">Membership status</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {membershipLabel(user.membership)}
            {user.membership?.type === "paid"
              ? ` · ${intervalLabel(user.billingInterval)}`
              : ""}
          </h2>
          <p className="mt-1 text-sm text-emerald-50/90">
            {subscription.message}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100">Status</p>
              <p className="mt-1 font-semibold">{subscription.status}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100">Started</p>
              <p className="mt-1 font-semibold">{formatPlanDateTime(subscription.startsAt)}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100">{subscription.active ? "Access ends" : "Ended"}</p>
              <p className="mt-1 font-semibold">{formatPlanDateTime(subscription.endsAt)}</p>
            </div>
          </div>
        </section>

        {cancellationDialogOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm"
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-membership-title"
              aria-describedby="cancel-membership-description"
              className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-lg font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                !
              </div>
              <h3
                id="cancel-membership-title"
                className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white"
              >
                Confirm no renewal
              </h3>
              <p
                id="cancel-membership-description"
                className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300"
              >
                This one-time payment will not renew automatically. Your Premium access remains available until the end of the paid period.
              </p>
              <form
                className="mt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCancellation();
                }}
              >
                <label
                  htmlFor="cancellation-confirmation"
                  className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Type <span className="font-mono font-semibold">CANCEL</span> to confirm
                </label>
                <input
                  id="cancellation-confirmation"
                  autoFocus
                  value={cancellationConfirmation}
                  onChange={(event) => setCancellationConfirmation(event.target.value)}
                  placeholder="CANCEL"
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-rose-400 dark:focus:ring-rose-950"
                />
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (switchingKey) return;
                      setCancellationDialogOpen(false);
                      setCancellationConfirmation("");
                    }}
                    disabled={Boolean(switchingKey)}
                    className="inline-flex justify-center rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Keep current plan
                  </button>
                  <button
                    type="submit"
                    disabled={cancellationConfirmation !== "CANCEL" || Boolean(switchingKey)}
                    className="inline-flex justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {switchingKey === "cancel-membership" ? "Confirming…" : "Confirm no renewal"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {payments.length > 0 && (
          <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                  Payment verification
                </h3>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  Latest Nagad payment status.
                </p>
              </div>
              <Link
                href="/membership/payments"
                className="mt-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 sm:mt-0"
              >
                View full history →
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {payments.slice(0, 1).map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        {payment.membership?.name || "Paid membership"} · {intervalLabel(payment.billingInterval)}
                      </p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${paymentStatusClass(payment.status)}`}>
                        {payment.status === "approved" ? "Verified" : payment.status === "rejected" ? "Rejected" : "Awaiting verification"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Nagad transaction ID: <span className="font-mono font-medium">{payment.transactionId}</span>
                    </p>
                    {payment.planStartedAt && payment.planEndsAt && (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Access: {formatPlanDateTime(payment.planStartedAt)} – {formatPlanDateTime(payment.planEndsAt)}
                      </p>
                    )}
                    {payment.reviewNote && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                        Admin note: {payment.reviewNote}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-semibold text-zinc-900 dark:text-white">
                    {formatMembershipPrice(payment.amount)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {actionError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
          >
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
          >
            {actionSuccess}
          </div>
        )}

        <section>
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
                Choose your plan
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Every paid schedule includes the same premium access.
              </p>
            </div>
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              Change or cancel your plan anytime
            </p>
          </div>

          {plans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400">
              No membership plans are available yet.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {plans.flatMap((plan) => {
                if (plan.type === "free") {
                  const isCurrent = plan.id === currentId;
                  const isSwitching = switchingKey === `${plan.id}:free`;

                  return (
                    <article
                      key={plan.id}
                      className="relative flex min-h-[29rem] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_28px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_16px_36px_rgba(0,0,0,0.08)] sm:p-7 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
                      <div className="flex min-h-[6.5rem] items-start">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                            15-day Trial
                          </p>
                          <h4 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                            {plan.name}
                          </h4>
                        </div>
                      </div>
                      <p className="mt-3 min-h-[5.25rem] text-[15px] leading-6 text-zinc-500 dark:text-zinc-400">
                        {plan.description || "Try every Premium feature for 15 days, with no payment details required."}
                      </p>
                      <div className="my-6 flex min-h-[8.25rem] flex-col justify-center border-y border-zinc-100 py-5 dark:border-zinc-800">
                        <span className="text-4xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white">৳0</span>
                        <span className="ml-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">/ 15 days</span>
                        <span className="mt-2 w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">No card required</span>
                      </div>
                      <div className="mt-1 mb-6">
                        <p className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                          Included features
                        </p>
                        <ul className="space-y-3 text-[15px] text-zinc-700 dark:text-zinc-300">
                        {FREE_FEATURES.map((feature) => (
                          <li key={feature} className="flex items-center gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><CheckIcon /></span>
                            {feature}
                          </li>
                        ))}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelect(plan)}
                        disabled={Boolean(switchingKey) || isCurrent}
                        className={`mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-default ${
                          isCurrent
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900"
                            : "bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                        }`}
                      >
                        {isSwitching ? <><SpinnerIcon className="animate-spin" /> Switching…</> : isCurrent ? <><CheckIcon /> Current plan</> : "Trial access"}
                      </button>
                    </article>
                  );
                }

                const billingOptions: Array<{
                  interval: BillingInterval;
                  label: string;
                  price: number;
                }> = [
                  { interval: "monthly", label: "Monthly", price: plan.monthlyPrice },
                  { interval: "quarterly", label: "Quarterly", price: plan.quarterlyPrice },
                  { interval: "yearly", label: "Yearly", price: plan.yearlyPrice },
                ];

                return billingOptions.map(({ interval, label, price }) => {
                  const isCurrent = plan.id === currentId && user.billingInterval === interval;
                  const actionKey = `${plan.id}:${interval}`;
                  const isSwitching = switchingKey === actionKey;
                  const isFeatured = interval === "yearly";
                  const months = interval === "quarterly" ? 3 : interval === "yearly" ? 12 : 1;
                  const savings = Math.max(0, plan.monthlyPrice * months - price);
                  const note =
                    savings > 0
                      ? `Save ${formatMembershipPrice(savings)} vs monthly`
                      : "Maximum flexibility";
                  const term =
                    interval === "quarterly"
                      ? "3 months"
                      : interval === "yearly"
                        ? "12 months"
                        : "1 month";
                  const hasMonthlyEquivalent = interval !== "monthly";
                  const priceSuffix =
                    interval === "yearly"
                      ? "year"
                      : interval === "quarterly"
                        ? "quarter"
                        : term;
                  const supportingText = hasMonthlyEquivalent
                    ? `≈ ${formatMembershipPrice(price / months)} per month`
                    : note;

                  return (
                    <article
                      key={actionKey}
                      className={`relative flex min-h-[29rem] flex-col overflow-hidden rounded-2xl border bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_28px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_16px_36px_rgba(0,0,0,0.1)] sm:p-7 dark:bg-zinc-900 ${
                        isFeatured
                          ? "border-gold/70 bg-gradient-to-b from-gold/[0.08] via-white to-white ring-1 ring-gold/30 dark:border-gold/60 dark:from-gold/[0.08] dark:via-zinc-900 dark:to-zinc-900"
                          : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <div
                        aria-hidden
                        className={`absolute inset-x-0 top-0 h-1 ${
                          isFeatured ? "bg-gold" : "bg-brand"
                        }`}
                      />
                      {isFeatured && (
                        <div className="absolute right-0 top-0 rounded-bl-2xl bg-brand px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-gold">
                          Best value
                        </div>
                      )}
                      <div className="min-h-[6.5rem]">
                        <div>
                          <span className="hidden">
                            Premium · {label}
                          </span>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand dark:text-gold">
                            Premium plan
                          </p>
                          <h4 className="mt-2 whitespace-nowrap text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                            {label}
                          </h4>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {term} of {plan.name} access
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 min-h-[5.25rem] text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                        {plan.description || "Premium access with a billing schedule that works for you."}
                      </p>
                      <div className="my-6 flex min-h-[8.25rem] flex-col justify-center border-y border-zinc-100 py-5 dark:border-zinc-800">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <span className="text-4xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white">{formatMembershipPrice(price)}</span>
                            <span className="ml-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">/ {priceSuffix}</span>
                          </div>
                          {savings > 0 && (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
                              Save {formatMembershipPrice(savings)}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{supportingText}</p>
                      </div>
                      <div className="mt-1 mb-6">
                        <p className="mb-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                          Included features
                        </p>
                        <ul className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {PREMIUM_FEATURES.map((feature) => (
                          <li key={feature} className="flex items-center gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-gold/10 dark:text-gold"><CheckIcon /></span>
                            {feature}
                          </li>
                        ))}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelect(plan, interval)}
                        disabled={Boolean(switchingKey) || isCurrent}
                        className={`mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-default ${
                          isCurrent
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900"
                            : "bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand-deep disabled:opacity-50"
                        }`}
                      >
                        {isSwitching ? <><SpinnerIcon className="animate-spin" /> Switching…</> : isCurrent ? <><CheckIcon /> Current plan</> : `Choose ${label}`}
                      </button>
                    </article>
                  );
                });
              })}
            </div>
          )}
        </section>

        {isPaidMembership && subscription.active && (
          <section className="mt-8">
            <details className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm text-zinc-600 transition hover:bg-zinc-50 [&::-webkit-details-marker]:hidden dark:text-zinc-300 dark:hover:bg-zinc-800/70">
                <span>
                  <span className="block font-medium text-zinc-800 dark:text-zinc-100">
                    {user.cancelledAt
                      ? "Renewal cancellation confirmed"
                      : "Need to cancel your membership?"}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                    {user.cancelledAt
                      ? "Your plan will end automatically at the time shown above."
                      : "This one-time paid plan does not renew automatically."}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-zinc-500 group-open:text-zinc-700 dark:text-zinc-400 dark:group-open:text-zinc-200">
                  <span className="group-open:hidden">Show</span>
                  <span className="hidden group-open:inline">Hide</span>
                </span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-zinc-100 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {user.cancelledAt
                    ? "No future renewal will be created. Your current Premium access remains available until the end of this paid period."
                    : "There is no automatic charge or renewal. Your Premium access ends automatically at the time shown above."}
                </p>
                {!user.cancelledAt && (
                  <button
                    type="button"
                    onClick={openCancellationDialog}
                    disabled={Boolean(switchingKey)}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    Confirm no renewal
                  </button>
                )}
              </div>
            </details>
          </section>
        )}
        </div>
      </div>
    </div>
  );
}
