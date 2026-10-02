import { NotFoundException } from '@nestjs/common';

// Keep this service unit test independent of unrelated Mongoose decorators.
jest.mock('./user.schema', () => ({ User: class User {} }));
jest.mock('../memberships/memberships.service', () => ({
  MembershipsService: class MembershipsService {},
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { Model } from 'mongoose';
import { MembershipsService } from '../memberships/memberships.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RolesService } from '../roles/roles.service';
import { UserDocument } from './user.schema';
import { UsersService } from './users.service';

type Account = {
  id: string;
  deletedAt: Date | null;
  onboardingStatus?: 'pending' | 'completed' | 'skipped';
  onboardingStep?: number;
  onboardingPeriod?: string | null;
};

// Model the database's atomic conditional update to exercise out-of-order
// requests and ownership across accounts without a live MongoDB connection.
function fixture() {
  const accounts: Account[] = [
    {
      id: 'owner',
      deletedAt: null,
      onboardingStatus: 'pending',
      onboardingStep: 0,
    },
    {
      id: 'other',
      deletedAt: null,
      onboardingStatus: 'pending',
      onboardingStep: 0,
    },
    { id: 'legacy', deletedAt: null },
  ];
  const query = (account: Account | null) => {
    const chain = {
      populate: () => chain,
      exec: () => Promise.resolve(account as unknown as UserDocument | null),
    };
    return chain;
  };
  const model = {
    updateOne: (
      filter: {
        _id: string;
        deletedAt: null;
        onboardingStatus: string;
        onboardingPeriod: null;
      },
      update: { $set: { onboardingPeriod: string } },
    ) => {
      const account = accounts.find(
        (entry) =>
          entry.id === filter._id &&
          entry.deletedAt === null &&
          entry.onboardingStatus === filter.onboardingStatus &&
          entry.onboardingPeriod == null,
      );
      if (account) account.onboardingPeriod = update.$set.onboardingPeriod;
      return query(null);
    },
    findOne: (filter: { _id: string; deletedAt: null }) =>
      query(
        accounts.find(
          (account) =>
            account.id === filter._id && account.deletedAt === filter.deletedAt,
        ) ?? null,
      ),
    findOneAndUpdate: (
      filter: { _id: string; deletedAt: null; onboardingStatus: string },
      update: {
        $max?: { onboardingStep: number };
        $set?: { onboardingStatus: Account['onboardingStatus'] };
      },
    ) => {
      const account = accounts.find(
        (item) =>
          item.id === filter._id &&
          item.deletedAt === filter.deletedAt &&
          item.onboardingStatus === filter.onboardingStatus,
      );
      if (account) {
        if (update.$max)
          account.onboardingStep = Math.max(
            account.onboardingStep ?? 0,
            update.$max.onboardingStep,
          );
        if (update.$set)
          account.onboardingStatus = update.$set.onboardingStatus;
      }
      return query(account ?? null);
    },
  };
  const service = new UsersService(
    model as unknown as Model<UserDocument>,
    {} as RolesService,
    {} as MembershipsService,
    {} as NotificationsService,
  );
  return { accounts, service };
}

describe('Account onboarding progress', () => {
  it('saves progress only for the supplied authenticated account', async () => {
    const { service, accounts } = fixture();
    await service.updateOnboarding('owner', { step: 1 });
    expect((await service.findOne('owner')).onboardingStep).toBe(1);
    expect(accounts[1].onboardingStep).toBe(0);
  });

  it('retains the furthest step when requests arrive out of order', async () => {
    const { service } = fixture();
    await service.updateOnboarding('owner', { step: 2 });
    await service.updateOnboarding('owner', { step: 1 });
    expect((await service.findOne('owner')).onboardingStep).toBe(2);
  });

  it.each(['completed', 'skipped'] as const)(
    'keeps %s setup closed after delayed requests',
    async (status) => {
      const { service } = fixture();
      await service.updateOnboarding('owner', { step: 1, status });
      await service.updateOnboarding('owner', { step: 2 });
      await service.updateOnboarding('owner', {
        status: status === 'completed' ? 'skipped' : 'completed',
      });
      expect(await service.findOne('owner')).toMatchObject({
        onboardingStatus: status,
        onboardingStep: 1,
      });
    },
  );

  it('leaves legacy accounts out of first-run setup', async () => {
    const { service, accounts } = fixture();
    await service.updateOnboarding('legacy', { step: 1, status: 'skipped' });
    expect(accounts[2].onboardingStatus).toBeUndefined();
    expect(accounts[2].onboardingStep).toBeUndefined();
  });

  it('anchors setup to its original month across retries and month boundaries', async () => {
    const { service } = fixture();
    await service.updateOnboarding('owner', { period: '2026-10', step: 1 });
    await service.updateOnboarding('owner', { period: '2026-11', step: 3 });
    expect(await service.findOne('owner')).toMatchObject({
      onboardingPeriod: '2026-10',
      onboardingStep: 3,
    });
  });

  it('rejects missing and deleted accounts', async () => {
    const { service, accounts } = fixture();
    accounts[0].deletedAt = new Date();
    await expect(
      service.updateOnboarding('owner', { status: 'completed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.updateOnboarding('missing', { step: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
