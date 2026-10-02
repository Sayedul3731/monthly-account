import 'dotenv/config';
import mongoose, { ClientSession, Types } from 'mongoose';
import { setServers } from 'node:dns';
import { BillingInterval } from '../modules/memberships/billing-interval.enum';
import { paidPlanDates } from '../modules/manual-payments/plan-dates';

type RepairPayment = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  membershipId: Types.ObjectId;
  transactionId: string;
  status: string;
  billingInterval: BillingInterval;
  reviewedAt?: Date | null;
  planStartedAt?: Date | null;
  planEndsAt?: Date | null;
  deletedAt?: Date | null;
  updatedAt?: Date;
};
type RepairUser = {
  _id: Types.ObjectId;
  membershipId: Types.ObjectId;
  billingInterval?: BillingInterval | null;
  planStartedAt?: Date | null;
  planEndsAt?: Date | null;
  cancelledAt?: Date | null;
  deletedAt?: Date | null;
  updatedAt?: Date;
};
type RepairMembership = {
  _id: Types.ObjectId;
  type: string;
  deletedAt?: Date | null;
};

// Deliberately targeted: do not change other users or overwrite a newer plan.
// Usage: npx ts-node src/scripts/repair-legacy-manual-payment.ts TRANSACTION_ID [--apply]
async function repair(session?: ClientSession) {
  const transactionId = process.argv[2]?.trim().toUpperCase();
  if (!transactionId || transactionId.startsWith('--')) {
    throw new Error('A Nagad transaction ID is required.');
  }
  const options = session ? { session } : {};
  const payments =
    mongoose.connection.collection<RepairPayment>('manual_payments');
  const users = mongoose.connection.collection<RepairUser>('users');
  const payment = await payments.findOne(
    { transactionId, deletedAt: null },
    options,
  );
  if (!payment || payment.status !== 'approved' || !payment.reviewedAt) {
    throw new Error(
      'An approved payment with its original review date is required.',
    );
  }
  if (Boolean(payment.planStartedAt) !== Boolean(payment.planEndsAt)) {
    throw new Error(
      'This payment has an incomplete access period; review it manually.',
    );
  }
  if (!Object.values(BillingInterval).includes(payment.billingInterval)) {
    throw new Error('The payment has an invalid billing interval.');
  }
  const reviewedAt = new Date(payment.reviewedAt);
  if (!Number.isFinite(reviewedAt.getTime()))
    throw new Error('Invalid review date.');
  const membership = await mongoose.connection
    .collection<RepairMembership>('memberships')
    .findOne(
      {
        _id: payment.membershipId,
        type: 'paid',
        deletedAt: null,
      },
      options,
    );
  const user = await users.findOne(
    { _id: payment.userId, deletedAt: null },
    options,
  );
  if (!membership || !user)
    throw new Error('The paid plan or account is unavailable.');
  if (user.planStartedAt || user.planEndsAt || user.cancelledAt) {
    throw new Error(
      'The account already has a paid period or cancellation; review it manually.',
    );
  }
  const currentMembership = await mongoose.connection
    .collection<RepairMembership>('memberships')
    .findOne({ _id: user.membershipId, deletedAt: null }, options);
  if (
    currentMembership?.type !== 'free' &&
    !user.membershipId.equals(payment.membershipId)
  ) {
    throw new Error(
      'The account has a different paid membership; review it manually.',
    );
  }
  const earlierLegacy = await payments.findOne(
    {
      _id: { $ne: payment._id },
      userId: payment.userId,
      status: 'approved',
      deletedAt: null,
      planEndsAt: null,
    },
    options,
  );
  if (earlierLegacy)
    throw new Error(
      'Earlier legacy approvals need their own access periods first.',
    );
  const previous = await payments.findOne(
    {
      userId: payment.userId,
      status: 'approved',
      deletedAt: null,
      reviewedAt: { $lte: reviewedAt },
      planEndsAt: { $gt: reviewedAt },
    },
    { ...options, sort: { planEndsAt: -1 } },
  );
  const backfill = !payment.planEndsAt;
  const dates = backfill
    ? paidPlanDates(previous?.planEndsAt ?? reviewedAt, payment.billingInterval)
    : {
        planStartedAt: new Date(payment.planStartedAt!),
        planEndsAt: new Date(payment.planEndsAt!),
      };
  const latest = await payments.findOne(
    {
      _id: { $ne: payment._id },
      userId: payment.userId,
      status: 'approved',
      deletedAt: null,
      planEndsAt: { $gt: dates.planEndsAt },
    },
    { ...options, sort: { planEndsAt: -1 } },
  );
  const access = latest ?? { ...payment, ...dates };
  const accessMembership = await mongoose.connection
    .collection<RepairMembership>('memberships')
    .findOne(
      {
        _id: access.membershipId,
        type: 'paid',
        deletedAt: null,
      },
      options,
    );
  if (
    !accessMembership ||
    !access.planStartedAt ||
    !access.planEndsAt ||
    !Number.isFinite(access.planEndsAt.getTime())
  )
    throw new Error('The current approved access period is invalid.');
  const active = new Date(access.planEndsAt) > new Date();
  const preview = {
    transactionId,
    billingInterval: payment.billingInterval,
    ...dates,
    backfill,
    restorePremium: active,
    currentAccess: {
      transactionId: access.transactionId,
      billingInterval: access.billingInterval,
      planStartedAt: access.planStartedAt,
      planEndsAt: access.planEndsAt,
    },
    applied: Boolean(session),
  };
  if (session) {
    if (backfill) {
      const result = await payments.updateOne(
        {
          _id: payment._id,
          status: 'approved',
          deletedAt: null,
          planStartedAt: null,
          planEndsAt: null,
        },
        { $set: { ...dates, updatedAt: new Date() } },
        options,
      );
      if (result.modifiedCount !== 1)
        throw new Error('Payment changed during repair.');
    }
    // Expired historical approvals are backfilled without granting new access.
    if (active) {
      const activation = await users.updateOne(
        {
          _id: user._id,
          deletedAt: null,
          membershipId: user.membershipId,
          planStartedAt: null,
          planEndsAt: null,
          cancelledAt: null,
        },
        {
          $set: {
            membershipId: access.membershipId,
            billingInterval: access.billingInterval,
            planStartedAt: access.planStartedAt,
            planEndsAt: access.planEndsAt,
            cancelledAt: null,
            updatedAt: new Date(),
          },
        },
        options,
      );
      if (activation.modifiedCount !== 1)
        throw new Error('Account changed during repair.');
    }
  }
  return preview;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required.');
  const servers = (process.env.MONGODB_DNS_SERVERS ?? '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  if (uri.startsWith('mongodb+srv://') && servers.length) setServers(servers);
  await mongoose.connect(uri, {
    autoSelectFamily: false,
    serverSelectionTimeoutMS: 10000,
  });
  const result = process.argv.includes('--apply')
    ? await mongoose.connection.transaction((session) => repair(session))
    : await repair();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error: unknown) => {
    // Do not include connection strings or account details in command output.
    console.error(error instanceof Error ? error.message : 'Repair failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
