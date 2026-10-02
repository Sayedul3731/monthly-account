import type { ManualPayment } from "./api";
import type { AuthUser } from "./auth";
import { subscriptionSummary } from "./membership-status";

export function checkoutPaymentStatus(payment: ManualPayment, user: AuthUser, now = Date.now()) {
  if (payment.status === "pending") {
    return { title: "Awaiting review", message: "Your payment is awaiting administrator verification.", needsAttention: false };
  }
  if (payment.status === "rejected") {
    return { title: "Previous payment rejected", message: "You can submit a new transaction for this purchase.", needsAttention: false };
  }
  const end = payment.planEndsAt ? Date.parse(payment.planEndsAt) : NaN;
  const membership = subscriptionSummary(user, now);
  const premiumActive = user.membership?.type === "paid" && membership.active;
  const needsAttention = (!Number.isFinite(end) || end > now) && !premiumActive;
  return {
    title: "Previous payment approved",
    needsAttention,
    message: needsAttention
      ? "This payment was approved, but your account has no active Premium access. Contact the administrator before sending another payment."
      : Number.isFinite(end) && end <= now
        ? "That payment's access period has ended. A new submission is a separate purchase."
        : "This approval belongs to the transaction below. A new submission is a separate purchase.",
  };
}
