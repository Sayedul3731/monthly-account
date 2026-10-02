import { BillingInterval } from '../memberships/billing-interval.enum';
import { paidPlanDates } from './plan-dates';

describe('paid access periods', () => {
  it('anchors a legacy month to the original approval date', () => {
    const dates = paidPlanDates(
      new Date('2026-09-17T09:17:57.543Z'),
      BillingInterval.MONTHLY,
    );
    expect(dates.planStartedAt.toISOString()).toBe('2026-09-17T09:17:57.543Z');
    expect(dates.planEndsAt.toISOString()).toBe('2026-10-17T09:17:57.543Z');
  });

  it.each([
    [
      '2026-01-31T09:00:00Z',
      BillingInterval.MONTHLY,
      '2026-02-28T09:00:00.000Z',
    ],
    [
      '2028-01-31T09:00:00Z',
      BillingInterval.MONTHLY,
      '2028-02-29T09:00:00.000Z',
    ],
    [
      '2026-11-30T09:00:00Z',
      BillingInterval.QUARTERLY,
      '2027-02-28T09:00:00.000Z',
    ],
    [
      '2028-02-29T09:00:00Z',
      BillingInterval.YEARLY,
      '2029-02-28T09:00:00.000Z',
    ],
  ])('clamps %s with %s billing to a calendar date', (start, interval, end) => {
    const original = new Date(start);
    expect(paidPlanDates(original, interval).planEndsAt.toISOString()).toBe(
      end,
    );
    expect(original.toISOString()).toBe(new Date(start).toISOString());
  });
});
