"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchMe,
  fetchMemberships,
  updateMembership,
  type BillingInterval,
  type Membership,
} from "@/lib/api";
import {
  clearAuthSession,
  getAccessToken,
  type AuthUser,
} from "@/lib/auth";
import { formatCurrency } from "@/lib/finance";
import { ChevronLeft, SpinnerIcon } from "./icons";

function membershipLabel(membership?: AuthUser["membership"]): string {
  if (!membership?.name) return "Free";
  return membership.name;
}

function typeLabel(type: Membership["type"]): string {
  return type === "paid" ? "Paid" : "Free";
}

function intervalLabel(interval?: BillingInterval | null): string {
  return interval === "yearly" ? "yearly" : "monthly";
}

function priceLabel(membership: Membership): string {
  if (membership.type === "free") return "Free";
  return `${formatCurrency(membership.monthlyPrice)} / month · ${formatCurrency(membership.yearlyPrice)} / year`;
}

function currentPlanDetail(user: AuthUser): string {
  if (user.membership?.type !== "paid") {
    return (
      user.membership?.description ||
      "Choose Free or Paid based on how you want to use the app."
    );
  }

  const price =
    user.billingInterval === "yearly"
      ? `${formatCurrency(user.membership.yearlyPrice)} / year`
      : `${formatCurrency(user.membership.monthlyPrice)} / month`;

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
    <div className="relative min-h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(16,185,129,0.1),transparent)]"
      />

      <div className="relative mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="shrink-0">
              <Image
                src="/logo.png"
                alt="My Account logo"
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl object-contain"
                priority
              />
            </Link>
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Account settings
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Membership
              </h1>
            </div>
          </div>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <ChevronLeft />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        </header>

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

        <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.25)]">
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              Plans
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Paid is $1 / month or $6 / year.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Price</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {plans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      No membership plans are available yet.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => {
                    const isPaid = plan.type === "paid";
                    const isCurrentFree =
                      !isPaid && plan.id === currentId;
                    const isCurrentMonthly =
                      isPaid &&
                      plan.id === currentId &&
                      user.billingInterval === "monthly";
                    const isCurrentYearly =
                      isPaid &&
                      plan.id === currentId &&
                      user.billingInterval === "yearly";

                    function actionButton(
                      label: string,
                      interval?: BillingInterval,
                      isCurrent = false,
                    ) {
                      const actionKey = `${plan.id}:${interval ?? "free"}`;
                      const isSwitching = switchingKey === actionKey;

                      if (isCurrent) {
                        return (
                          <span className="inline-flex rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            Current
                          </span>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={() => handleSelect(plan, interval)}
                          disabled={Boolean(switchingKey)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSwitching ? (
                            <>
                              <SpinnerIcon className="animate-spin" />
                              Switching…
                            </>
                          ) : (
                            label
                          )}
                        </button>
                      );
                    }

                    return (
                      <tr
                        key={plan.id}
                        className="bg-white dark:bg-zinc-900"
                      >
                        <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-white">
                          {plan.name}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                              isPaid
                                ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"
                                : "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
                            }`}
                          >
                            {typeLabel(plan.type)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-zinc-700 dark:text-zinc-300">
                          {isPaid ? (
                            <div className="flex flex-col gap-0.5">
                              <span>
                                {formatCurrency(plan.monthlyPrice)} / month
                              </span>
                              <span>
                                {formatCurrency(plan.yearlyPrice)} / year
                              </span>
                            </div>
                          ) : (
                            priceLabel(plan)
                          )}
                        </td>
                        <td className="max-w-[14rem] px-6 py-4 text-zinc-500 dark:text-zinc-400">
                          {plan.description || "—"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isPaid ? (
                            <div className="flex flex-col items-end gap-2">
                              {actionButton(
                                "Choose monthly",
                                "monthly",
                                isCurrentMonthly,
                              )}
                              {actionButton(
                                "Choose yearly",
                                "yearly",
                                isCurrentYearly,
                              )}
                            </div>
                          ) : (
                            actionButton("Switch", undefined, isCurrentFree)
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
