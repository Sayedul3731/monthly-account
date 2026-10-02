import type { AuthUser } from "./auth";

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
        ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} of Premium access remaining.`
        : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining in your 15-day trial.`
      : expired
        ? isPremium
          ? "Your Premium access has ended. Choose a plan to continue using প্রতিদিনের হিসাব."
          : "Your 15-day trial has ended. Upgrade to Premium to continue using প্রতিদিনের হিসাব."
        : "We couldn’t confirm your access period. Refresh the page to check your membership details.",
  };
}
