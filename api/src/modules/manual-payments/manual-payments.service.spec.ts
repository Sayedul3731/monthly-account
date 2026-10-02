import { ConflictException } from '@nestjs/common';
import { ClientSession, Model, Types } from 'mongoose';

jest.mock('./manual-payment.schema', () => ({
  ManualPayment: class ManualPayment {},
}));
jest.mock('../users/user.schema', () => ({ User: class User {} }));
jest.mock('../memberships/membership.schema', () => ({
  Membership: class Membership {},
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { BillingInterval } from '../memberships/billing-interval.enum';
import { MembershipDocument } from '../memberships/membership.schema';
import { UserDocument } from '../users/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ManualPaymentDocument } from './manual-payment.schema';
import { ManualPaymentStatus } from './manual-payment-status.enum';
import { ManualPaymentsService } from './manual-payments.service';

const now = new Date('2026-10-02T06:00:00Z');
const reviewerId = new Types.ObjectId().toString();
const approval = {
  status: ManualPaymentStatus.APPROVED,
  reviewNote: 'Verified',
} as const;

function fixture() {
  let payment: Record<string, unknown> = {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    membershipId: new Types.ObjectId(),
    billingInterval: BillingInterval.MONTHLY,
    status: ManualPaymentStatus.PENDING,
    transactionId: 'PAYMENT123',
    planStartedAt: null,
    planEndsAt: null,
  };
  let user: Record<string, unknown> = {
    membershipId: 'trial',
    planStartedAt: null,
    planEndsAt: null,
  };
  let activePayment: { planEndsAt: Date } | null = null;
  let activationFailure: Error | 'missing' | null = null;
  let currentSession: ClientSession | null = null;
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  // Simulate rollback, while requiring every read/write inside the transaction
  // to use its session. This catches a write accidentally left outside it.
  function query(run: () => unknown) {
    let querySession: ClientSession | null = null;
    const chain = {
      session: (session: ClientSession | null) => {
        querySession = session;
        return chain;
      },
      sort: () => chain,
      populate: () => chain,
      exec: () => {
        expect(querySession).toBe(currentSession);
        return Promise.resolve().then(run);
      },
    };
    return chain;
  }
  const transaction = jest.fn(
    async (run: (session: ClientSession) => Promise<unknown>) => {
      const beforePayment = { ...payment };
      const beforeUser = { ...user };
      currentSession = {} as ClientSession;
      try {
        return await run(currentSession);
      } catch (error) {
        payment = beforePayment;
        user = beforeUser;
        throw error;
      } finally {
        currentSession = null;
      }
    },
  );
  const paymentModel = {
    db: { transaction },
    findOne: (filter: Record<string, unknown>) =>
      query(() =>
        filter.status === 'approved'
          ? activePayment
          : { ...payment, toJSON: () => ({ ...payment }) },
      ),
    findOneAndUpdate: (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
    ) =>
      query(() => {
        if (payment.status !== filter.status) return null;
        payment = { ...payment, ...update };
        return payment;
      }),
  };
  const userModel = {
    findOne: () => query(() => ({ ...user })),
    updateOne: (_filter: unknown, update: Record<string, unknown>) =>
      query(() => {
        if (activationFailure === 'missing') return { matchedCount: 0 };
        if (activationFailure) throw activationFailure;
        user = { ...user, ...update };
        return { matchedCount: 1 };
      }),
  };
  const membershipModel = { findOne: () => query(() => ({ type: 'paid' })) };
  const service = new ManualPaymentsService(
    paymentModel as unknown as Model<ManualPaymentDocument>,
    userModel as unknown as Model<UserDocument>,
    membershipModel as unknown as Model<MembershipDocument>,
    notifications as unknown as NotificationsService,
  );
  return {
    service,
    transaction,
    notifications,
    payment: () => payment,
    user: () => user,
    failActivation: (failure: Error | 'missing' | null) => {
      activationFailure = failure;
    },
    existingAccess: (end: Date) => {
      activePayment = { planEndsAt: end };
    },
  };
}

describe('manual payment approval and membership activation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });
  afterEach(() => jest.useRealTimers());

  it('commits approval and matching Premium access together', async () => {
    const f = fixture();
    await f.service.review('payment', reviewerId, approval);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.payment().status).toBe('approved');
    expect(f.user()).toMatchObject({
      membershipId: f.payment().membershipId,
      billingInterval: BillingInterval.MONTHLY,
      planStartedAt: now,
      planEndsAt: new Date('2026-11-02T06:00:00Z'),
      cancelledAt: null,
    });
    expect(f.notifications.create).toHaveBeenCalledTimes(1);
  });

  it.each(['missing', new Error('Activation failed')])(
    'rolls back approval when activation fails: %s',
    async (failure) => {
      const f = fixture();
      f.failActivation(failure as Error | 'missing');
      await expect(
        f.service.review('payment', reviewerId, approval),
      ).rejects.toThrow();
      expect(f.payment().status).toBe('pending');
      expect(f.payment().planEndsAt).toBeNull();
      expect(f.user().membershipId).toBe('trial');
      expect(f.notifications.create).not.toHaveBeenCalled();
      f.failActivation(null);
      await f.service.review('payment', reviewerId, approval);
      expect(f.payment().status).toBe('approved');
      expect(f.user().planEndsAt).toEqual(f.payment().planEndsAt);
    },
  );

  it('extends a renewal from existing paid access rather than the review time', async () => {
    const f = fixture();
    f.existingAccess(new Date('2026-10-31T06:00:00Z'));
    await f.service.review('payment', reviewerId, approval);
    expect(f.user().planStartedAt).toEqual(new Date('2026-10-31T06:00:00Z'));
    expect(f.user().planEndsAt).toEqual(new Date('2026-11-30T06:00:00Z'));
  });

  it('does not activate Premium for a rejected payment', async () => {
    const f = fixture();
    await f.service.review('payment', reviewerId, {
      status: ManualPaymentStatus.REJECTED,
      reviewNote: 'Invalid transaction',
    });
    expect(f.transaction).not.toHaveBeenCalled();
    expect(f.payment().status).toBe('rejected');
    expect(f.user().membershipId).toBe('trial');
    expect(f.user().planEndsAt).toBeNull();
  });

  it('rejects repeated approval without granting another period', async () => {
    const f = fixture();
    await f.service.review('payment', reviewerId, approval);
    const end = f.user().planEndsAt;
    await expect(
      f.service.review('payment', reviewerId, approval),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(f.user().planEndsAt).toEqual(end);
    expect(f.notifications.create).toHaveBeenCalledTimes(1);
  });
});
