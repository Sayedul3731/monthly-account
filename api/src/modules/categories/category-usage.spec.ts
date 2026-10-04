import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { CategoryDocument } from './category.schema';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionDocument } from '../transactions/transaction.schema';
import { TransactionType } from '../transactions/transaction-type.enum';
import { TransactionTypeDocument } from '../transaction-types/transaction-type.schema';
import { UserDocument } from '../users/user.schema';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { RecurringExpenseDocument } from '../recurring-expenses/recurring-expense.schema';

jest.mock('../users/user.schema', () => ({ User: class User {} }));

const owner = new Types.ObjectId();
const other = new Types.ObjectId();
const expenseType = new Types.ObjectId();
const sharedId = new Types.ObjectId();
const ownedId = new Types.ObjectId();
const foreignId = new Types.ObjectId();

function scalar(value: unknown): string {
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (value == null) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value);
  throw new Error('Unexpected fixture value');
}

type FixtureEntry = {
  _id: Types.ObjectId;
  id: string;
  userId: Types.ObjectId;
  categoryId: Types.ObjectId;
  transactionTypeId: Types.ObjectId;
  deletedAt: null;
  save: jest.Mock<Promise<FixtureEntry>, []>;
  toJSON: () => { id: string; userId: string; categoryId: string };
};

function matches(
  record: Record<string, unknown>,
  filter: Record<string, unknown>,
): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or')
      return (value as Record<string, unknown>[]).some((part) =>
        matches(record, part),
      );
    return value === null
      ? record[key] == null
      : scalar(record[key]) === scalar(value);
  });
}

function query<T>(value: T) {
  return { exec: () => Promise.resolve(value), populate: () => query(value) };
}

function fixture() {
  const categories = [
    {
      _id: sharedId,
      type: TransactionType.EXPENSE,
      name: 'Shared',
      deletedAt: null,
    },
    {
      _id: ownedId,
      type: TransactionType.EXPENSE,
      name: 'Owned',
      userId: owner,
      deletedAt: null,
    },
    {
      _id: foreignId,
      type: TransactionType.EXPENSE,
      name: 'Other account',
      userId: other,
      deletedAt: null,
    },
  ];
  const categoryModel = {
    findOne: (filter: Record<string, unknown>) =>
      query(categories.find((category) => matches(category, filter)) ?? null),
  };
  const typeModel = {
    findOne: () => query({ _id: expenseType, name: TransactionType.EXPENSE }),
  };
  const account = {
    _id: owner,
    onboardingStatus: 'pending',
    onboardingPeriod: '2026-10',
    deletedAt: null,
  };
  const userModel = {
    findOne: (filter: Record<string, unknown>) =>
      query(matches(account, filter) ? account : null),
  };
  const record: FixtureEntry = {
    _id: new Types.ObjectId(),
    id: new Types.ObjectId().toString(),
    userId: owner,
    categoryId: sharedId,
    transactionTypeId: expenseType,
    deletedAt: null,
    save: jest.fn(() => Promise.resolve(record)),
    toJSON: () => ({
      id: record.id,
      userId: String(owner),
      categoryId: String(record.categoryId),
    }),
  };
  const entryModel = {
    findOne: (filter: Record<string, unknown>) =>
      query(matches({ ...record, _id: record.id }, filter) ? record : null),
    create: jest.fn((data: Record<string, unknown>) => {
      Object.assign(record, data);
      return Promise.resolve(record);
    }),
    findOneAndUpdate: jest.fn(() => query(record)),
  };
  const transactions = new TransactionsService(
    entryModel as unknown as Model<TransactionDocument>,
    userModel as unknown as Model<UserDocument>,
    categoryModel as unknown as Model<CategoryDocument>,
    typeModel as unknown as Model<TransactionTypeDocument>,
  );
  const recurring = new RecurringExpensesService(
    entryModel as unknown as Model<RecurringExpenseDocument>,
    entryModel as unknown as Model<TransactionDocument>,
    categoryModel as unknown as Model<CategoryDocument>,
    typeModel as unknown as Model<TransactionTypeDocument>,
  );
  const payload = (categoryId: Types.ObjectId) => ({
    categoryId: String(categoryId),
    transactionTypeId: String(expenseType),
    amount: 500,
    date: '2026-10-02',
    dayOfMonth: 2,
    description: null,
  });
  return { transactions, recurring, record, entryModel, payload };
}

describe('Category ownership on ledger writes', () => {
  it.each([
    ['shared', sharedId],
    ['personal', ownedId],
  ] as const)(
    'accepts a %s category on transactions, setup entries, and recurring expenses',
    async (_name, categoryId) => {
      const { transactions, recurring, record, payload } = fixture();
      await expect(
        transactions.create(String(owner), payload(categoryId)),
      ).resolves.toBeDefined();
      await expect(
        transactions.update(record.id, String(owner), payload(categoryId)),
      ).resolves.toBeDefined();
      await expect(
        transactions.saveOnboardingEntry(
          String(owner),
          TransactionType.EXPENSE,
          payload(categoryId),
        ),
      ).resolves.toBeDefined();
      await expect(
        recurring.create(String(owner), payload(categoryId)),
      ).resolves.toBeDefined();
      await expect(
        recurring.update(record.id, String(owner), payload(categoryId)),
      ).resolves.toBeDefined();
    },
  );

  it('rejects another account’s category ID on every create/update path without writing', async () => {
    const { transactions, recurring, record, entryModel, payload } = fixture();
    await expect(
      transactions.create(String(owner), payload(foreignId)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      transactions.update(record.id, String(owner), payload(foreignId)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      transactions.saveOnboardingEntry(
        String(owner),
        TransactionType.EXPENSE,
        payload(foreignId),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      recurring.create(String(owner), payload(foreignId)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      recurring.update(record.id, String(owner), payload(foreignId)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(entryModel.create).not.toHaveBeenCalled();
    expect(entryModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(record.save).not.toHaveBeenCalled();
  });
});
