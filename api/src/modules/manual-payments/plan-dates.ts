import { BillingInterval } from '../memberships/billing-interval.enum';

export function paidPlanDates(start: Date, interval: BillingInterval) {
  const months =
    interval === BillingInterval.YEARLY
      ? 12
      : interval === BillingInterval.QUARTERLY
        ? 3
        : 1;
  const planStartedAt = new Date(start);
  const planEndsAt = new Date(start);
  const day = planEndsAt.getUTCDate();
  planEndsAt.setUTCDate(1);
  planEndsAt.setUTCMonth(planEndsAt.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(planEndsAt.getUTCFullYear(), planEndsAt.getUTCMonth() + 1, 0),
  ).getUTCDate();
  planEndsAt.setUTCDate(Math.min(day, lastDay));
  return { planStartedAt, planEndsAt };
}
