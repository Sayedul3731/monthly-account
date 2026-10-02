import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';

// Isolate transaction behavior from catalog and membership schema decorators.
jest.mock('../users/user.schema', () => ({ User: class User {} }));
jest.mock('../categories/category.schema', () => ({
  Category: class Category {},
}));
jest.mock('../transaction-types/transaction-type.schema', () => ({
  TransactionTypeEntity: class TransactionTypeEntity {},
}));

import type { CategoryDocument } from '../categories/category.schema';
import type { TransactionTypeDocument } from '../transaction-types/transaction-type.schema';
import type { UserDocument } from '../users/user.schema';
import { TransactionDocument, TransactionSchema } from './transaction.schema';
import { TransactionType } from './transaction-type.enum';
import { TransactionsService } from './transactions.service';

const owner = new Types.ObjectId('507f1f77bcf86cd799439011');
const other = new Types.ObjectId('507f1f77bcf86cd799439012');
const incomeCategory = new Types.ObjectId('507f1f77bcf86cd799439021');
const expenseCategory = new Types.ObjectId('507f1f77bcf86cd799439022');
const incomeType = new Types.ObjectId('507f1f77bcf86cd799439031');
const expenseType = new Types.ObjectId('507f1f77bcf86cd799439032');

type RecordEntry = {
  id: string;
  userId: Types.ObjectId;
  onboardingKind: string;
  categoryId: Types.ObjectId;
  transactionTypeId: Types.ObjectId;
  amount: number;
  description: string | null;
  date: Date;
  deletedAt: Date | null;
};

function fixture() {
  const account = {
    _id: owner,
    onboardingStatus: 'pending',
    onboardingPeriod: '2026-10',
    deletedAt: null,
  };
  const records: RecordEntry[] = [];
  const query = <T>(result: T) => {
    const chain = {
      populate: () => chain,
      exec: () => Promise.resolve(result),
    };
    return chain;
  };
  const document = (entry: RecordEntry | undefined) =>
    entry
      ? {
          ...entry,
          toJSON: () => ({
            ...entry,
            userId: String(entry.userId),
            categoryId: String(entry.categoryId),
            transactionTypeId: String(entry.transactionTypeId),
          }),
        }
      : null;
  let collideOnce = false;
  const transactionModel = {
    findOne: (filter: {
      _id: string;
      userId: Types.ObjectId;
      deletedAt: null;
    }) =>
      query(
        document(
          records.find(
            (entry) =>
              entry.id === String(filter._id) &&
              String(entry.userId) === String(filter.userId) &&
              entry.deletedAt === filter.deletedAt,
          ),
        ),
      ),
    find: (filter: {
      userId: Types.ObjectId;
      deletedAt: null;
      onboardingKind: { $in: string[] };
    }) =>
      query(
        records
          .filter(
            (entry) =>
              String(entry.userId) === String(filter.userId) &&
              entry.deletedAt === filter.deletedAt &&
              filter.onboardingKind.$in.includes(entry.onboardingKind),
          )
          .map((entry) => document(entry)),
      ),
    findOneAndUpdate: jest.fn(
      (
        filter: { userId: Types.ObjectId; onboardingKind: string },
        update: { $set: Omit<RecordEntry, 'id' | 'userId' | 'onboardingKind'> },
        options: { upsert?: boolean },
      ) => {
        let record = records.find(
          (entry) =>
            String(entry.userId) === String(filter.userId) &&
            entry.onboardingKind === filter.onboardingKind,
        );
        if (!record && options.upsert) {
          record = {
            id: new Types.ObjectId().toString(),
            ...filter,
            ...update.$set,
          };
          records.push(record);
        }
        if (collideOnce) {
          collideOnce = false;
          return { exec: () => Promise.reject({ code: 11000 }) };
        }
        if (record) Object.assign(record, update.$set);
        return query(document(record));
      },
    ),
  };
  const userModel = {
    findOne: (filter: { _id: string; deletedAt: null }) =>
      query(
        String(filter._id) === String(account._id) &&
          account.deletedAt === filter.deletedAt
          ? account
          : null,
      ),
  };
  const categoryModel = {
    findOne: (filter: { _id: string }) =>
      query(
        filter._id === String(incomeCategory)
          ? { _id: incomeCategory, type: 'income', name: 'Salary' }
          : filter._id === String(expenseCategory)
            ? { _id: expenseCategory, type: 'expense', name: 'Food' }
            : null,
      ),
  };
  const typeModel = {
    findOne: (filter: { _id: string }) =>
      query(
        filter._id === String(incomeType)
          ? { _id: incomeType, name: 'income' }
          : filter._id === String(expenseType)
            ? { _id: expenseType, name: 'expense' }
            : null,
      ),
  };
  const service = new TransactionsService(
    transactionModel as unknown as Model<TransactionDocument>,
    userModel as unknown as Model<UserDocument>,
    categoryModel as unknown as Model<CategoryDocument>,
    typeModel as unknown as Model<TransactionTypeDocument>,
  );
  const payload = (kind: TransactionType, amount = 500) => ({
    categoryId: String(
      kind === TransactionType.INCOME ? incomeCategory : expenseCategory,
    ),
    transactionTypeId: String(
      kind === TransactionType.INCOME ? incomeType : expenseType,
    ),
    amount,
    description: null,
    date: '2026-10-02',
  });
  return {
    account,
    records,
    transactionModel,
    service,
    payload,
    collide: () => {
      collideOnce = true;
    },
  };
}

describe('First-session transactions', () => {
  it('updates the same expense on retries and edits instead of duplicating it', async () => {
    const { service, records, payload } = fixture();
    const first = await service.saveOnboardingEntry(
      String(owner),
      TransactionType.EXPENSE,
      payload(TransactionType.EXPENSE),
    );
    const retry = await service.saveOnboardingEntry(
      String(owner),
      TransactionType.EXPENSE,
      payload(TransactionType.EXPENSE),
    );
    const edited = await service.saveOnboardingEntry(
      String(owner),
      TransactionType.EXPENSE,
      payload(TransactionType.EXPENSE, 700),
    );
    expect(retry.id).toBe(first.id);
    expect(edited.id).toBe(first.id);
    expect(records).toHaveLength(1);
    expect((await service.findOnboardingEntries(String(owner)))[0].amount).toBe(
      700,
    );
  });

  it('keeps income and expense as separate real ledger entries', async () => {
    const { service, payload } = fixture();
    await service.saveOnboardingEntry(
      String(owner),
      TransactionType.INCOME,
      payload(TransactionType.INCOME, 40000),
    );
    await service.saveOnboardingEntry(
      String(owner),
      TransactionType.EXPENSE,
      payload(TransactionType.EXPENSE),
    );
    expect(
      (await service.findOnboardingEntries(String(owner))).map(
        (entry) => entry.amount,
      ),
    ).toEqual([40000, 500]);
    expect(await service.findOnboardingEntries(String(other))).toEqual([]);
  });

  it('recovers from a concurrent first-insert collision without a second entry', async () => {
    const { service, records, payload, collide, transactionModel } = fixture();
    collide();
    await service.saveOnboardingEntry(
      String(owner),
      TransactionType.EXPENSE,
      payload(TransactionType.EXPENSE),
    );
    expect(records).toHaveLength(1);
    expect(transactionModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(
      transactionModel.findOneAndUpdate.mock.calls[1][2].upsert,
    ).toBeUndefined();
  });

  it.each(['completed', 'skipped'])(
    'rejects first-run writes after setup is %s',
    async (status) => {
      const { account, service, payload, records } = fixture();
      account.onboardingStatus = status;
      await expect(
        service.saveOnboardingEntry(
          String(owner),
          TransactionType.EXPENSE,
          payload(TransactionType.EXPENSE),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(records).toHaveLength(0);
    },
  );

  it('rejects a transaction type or category that does not match the step', async () => {
    const { service, payload } = fixture();
    await expect(
      service.saveOnboardingEntry(
        String(owner),
        TransactionType.EXPENSE,
        payload(TransactionType.INCOME),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.saveOnboardingEntry(String(owner), TransactionType.EXPENSE, {
        ...payload(TransactionType.EXPENSE),
        categoryId: String(incomeCategory),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['2026-11-02', '2026-02-31', '2026-10-02T23:00:00Z', '2026-99-01'])(
    'rejects dates outside the setup month or invalid dates: %s',
    async (date) => {
      const { service, payload } = fixture();
      await expect(
        service.saveOnboardingEntry(String(owner), TransactionType.EXPENSE, {
          ...payload(TransactionType.EXPENSE),
          date,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('rejects attempts to write to another account', async () => {
    const { service, payload } = fixture();
    await expect(
      service.saveOnboardingEntry(
        String(other),
        TransactionType.EXPENSE,
        payload(TransactionType.EXPENSE),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('declares a unique user-and-kind index excluding ordinary transactions', () => {
    expect(TransactionSchema.indexes()).toContainEqual([
      { userId: 1, onboardingKind: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { onboardingKind: { $type: 'string' } },
      }),
    ]);
  });
});
