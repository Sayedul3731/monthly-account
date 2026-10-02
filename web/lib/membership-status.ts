import type { AuthUser } from "./auth";

function premiumTimeRemaining(now: number, daysRemaining: number): string {
  const start = new Date(now);
  const end = new Date(now + daysRemaining * 86_400_000);
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + end.getUTCMonth() - start.getUTCMonth();

  function afterMonths(count: number): Date {
    const date = new Date(start);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + count);
    const lastDay = new Date(Date.UTC(
      date.getUTCFullYear(), date.getUTCMonth() + 1, 0,
    )).getUTCDate();
    date.setUTCDate(Math.min(start.getUTCDate(), lastDay));
    return date;
  }

  if (afterMonths(months) > end) months -= 1;
  const days = Math.round((end.getTime() - afterMonths(months).getTime()) / 86_400_000);
  const parts: string[] = [];
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.join(" and ");
}

export function subscriptionSummary(user: AuthUser, now = Date.now()) {
  const isPremium = user.membership?.type === "paid";
  const startsAt = isPremium ? user.planStartedAt : user.trialStartedAt;
  const endsAt = isPremium ? user.planEndsAt : user.trialEndsAt;
  const endTime = endsAt ? new Date(endsAt).getTime() : NaN;
  const hasEndDate = Number.isFinite(endTime);
  const active = hasEndDate && endTime > now;
  const expired = hasEndDate && endTime <= now;
  const daysRemaining = active
    ? Math.ceil((endTime - now) / 86_400_000)
    : 0;

  return {
    active,
    expired,
    startsAt,
    endsAt,
    planName: isPremium ? "Premium" : "15-day Trial",
    status: active
      ? isPremium ? "Premium active" : "Trial active"
      : expired
        ? isPremium ? "Premium expired" : "Trial ended"
        : "Access unavailable",
    message: active
      ? isPremium
        ? `${premiumTimeRemaining(now, daysRemaining)} of Premium access remaining.`
        : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining in your 15-day trial.`
      : expired
        ? isPremium
          ? "Your Premium access has ended. Choose a plan to continue using প্রতিদিনের হিসাব."
          : "Your 15-day trial has ended. Upgrade to Premium to continue using প্রতিদিনের হিসাব."
        : "We couldn’t confirm your access period. Refresh the page to check your membership details.",
  };
}
