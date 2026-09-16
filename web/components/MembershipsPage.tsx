"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchMe,
  fetchMemberships,
  logoutUser,
  updateMembership,
  type BillingInterval,
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
import { CheckIcon, ChevronLeft, SpinnerIcon } from "./icons";

function membershipLabel(membership?: AuthUser["membership"]): string {
  if (!membership?.name) return "Free";
  return membership.name;
}

function typeLabel(type: Membership["type"]): string {
  return type === "paid" ? "Paid" : "Free";
}

function intervalLabel(interval?: BillingInterval | null): string {
  return interval === "quarterly"
    ? "quarterly"
    : interval === "yearly"
      ? "yearly"
      : "monthly";
}

function intervalPrice(
  membership: Pick<
    Membership,
    "monthlyPrice" | "quarterlyPrice" | "yearlyPrice"
  >,
  interval?: BillingInterval | null,
): number {
  if (interval === "quarterly") return membership.quarterlyPrice;
  if (interval === "yearly") return membership.yearlyPrice;
  return membership.monthlyPrice;
}

function formatMembershipPrice(value: unknown): string {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? formatCurrency(price) : "—";
}

function currentPlanDetail(user: AuthUser): string {
  if (user.membership?.type !== "paid") {
    return (
      user.membership?.description ||
      "Choose Free or Paid based on how you want to use the app."
    );
  }

  const price = `${formatMembershipPrice(intervalPrice(user.membership, user.billingInterval))} / ${intervalLabel(user.billingInterval)}`;

  return `Billed ${intervalLabel(user.billingInterval)} at ${price}.`;
}

export default function MembershipsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [plans, setPlans] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switchingKey, setSwitchingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [me, memberships] = await Promise.all([
          fetchMe(),
          fetchMemberships(),
        ]);
        if (cancelled) return;
        setUser(me);
        setPlans(memberships);
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
    const actionKey = `${plan.id}:${billingInterval ?? "free"}`;
    const isCurrent =
      plan.id === user?.membership?.id &&
      (plan.type === "free" || user?.billingInterval === billingInterval);

    if (!user || isCurrent || switchingKey) return;

    setActionError(null);
    setActionSuccess(null);
    setSwitchingKey(actionKey);

    try {
      const updated = await updateMembership(plan.id, billingInterval);
      setUser(updated);
      const intervalText =
        plan.type === "paid" && billingInterval
          ? ` (${intervalLabel(billingInterval)})`
          : "";
      setActionSuccess(`Switched to the ${plan.name} plan${intervalText}.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update membership",
      );
    } finally {
      setSwitchingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
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

  return (
    <div className="relative min-h-full overflow-x-hidden bg-zinc-50 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.1),transparent)]"
      />

      <div className="relative">
        <AppHeader
          signedIn
          user={{ name: user.name, email: user.email }}
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
          <p className="text-sm font-medium text-emerald-100">Current plan</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {membershipLabel(user.membership)}
            {user.membership?.type === "paid"
              ? ` · ${intervalLabel(user.billingInterval)}`
              : ""}
          </h2>
          <p className="mt-1 text-sm text-emerald-50/90">
            {currentPlanDetail(user)}
          </p>
        </section>

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
                      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-zinc-300 dark:bg-zinc-700" />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                            {typeLabel(plan.type)} plan
                          </p>
                          <h4 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                            {plan.name}
                          </h4>
                        </div>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
                            <CheckIcon /> Current
                          </span>
                        )}
                      </div>
                      <p className="mt-3 min-h-12 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                        {plan.description || "A simple way to keep your account active with no subscription cost."}
                      </p>
                      <div className="my-6 border-y border-zinc-100 py-5 dark:border-zinc-800">
                        <span className="text-4xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white">৳0</span>
                        <span className="ml-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">/ forever</span>
                      </div>
                      <ul className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {["No subscription cost", "Keep access to your account", "Switch to premium whenever you are ready"].map((feature) => (
                          <li key={feature} className="flex items-center gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><CheckIcon /></span>
                            {feature}
                          </li>
                        ))}
                      </ul>
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
                        {isSwitching ? <><SpinnerIcon className="animate-spin" /> Switching…</> : isCurrent ? <><CheckIcon /> Current plan</> : "Choose Free"}
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
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="hidden">
                            Premium · {label}
                          </span>
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand dark:text-gold">
                            Premium plan
                          </p>
                          <h4 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                            {label}
                          </h4>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {term} of {plan.name} access
                          </p>
                        </div>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
                            <CheckIcon /> Current
                          </span>
                        )}
                      </div>
                      <p className="mt-3 min-h-12 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                        {plan.description || "Premium access with a billing schedule that works for you."}
                      </p>
                      <div className="my-6 border-y border-zinc-100 py-5 dark:border-zinc-800">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <span className="text-4xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-white">{formatMembershipPrice(price)}</span>
                            <span className="ml-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">/ {term}</span>
                          </div>
                          {savings > 0 && (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900">
                              Save {formatMembershipPrice(savings)}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{note}</p>
                      </div>
                      <ul className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {["Full premium access", `One payment every ${term}`, "Switch schedules anytime"].map((feature) => (
                          <li key={feature} className="flex items-center gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-gold/10 dark:text-gold"><CheckIcon /></span>
                            {feature}
                          </li>
                        ))}
                      </ul>
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
        </div>
      </div>
    </div>
  );
}
