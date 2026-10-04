import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { CategoryDocument, CategorySchema } from './category.schema';
import { CategoriesService } from './categories.service';
import { Transaction } from '../transactions/transaction.schema';
import { TransactionType } from '../transactions/transaction-type.enum';
import { ensureCategoryOwnershipIndex } from './category-index';

// Membership schemas are unrelated to category ownership and are injected here.
jest.mock('../users/user.schema', () => ({ User: class User {} }));

const alice = new Types.ObjectId().toString();
const bob = new Types.ObjectId().toString();

type RecordData = Record<string, unknown>;
function scalar(value: unknown): string {
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (value == null) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value);
  throw new Error('Unexpected fixture value');
}

type FakeDocument = RecordData & {
  id: string;
  toJSON: () => RecordData;
  save: () => Promise<FakeDocument>;
};
function matches(record: RecordData, filter: RecordData): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or')
      return (value as RecordData[]).some((part) => matches(record, part));
    if (value && typeof value === 'object' && '$ne' in value) {
      return scalar(record[key]) !== scalar(value.$ne);
    }
    return value === null
      ? record[key] == null
      : scalar(record[key]) === scalar(value);
  });
}

function fixture() {
  const records: RecordData[] = [
    {
      _id: new Types.ObjectId(),
      name: 'Food',
      type: TransactionType.EXPENSE,
      deletedAt: null,
    },
    {
      _id: new Types.ObjectId(),
      name: 'Salary',
      type: TransactionType.INCOME,
      userId: null,
      deletedAt: null,
    },
    {
      _id: new Types.ObjectId(),
      name: 'Alice private',
      type: TransactionType.EXPENSE,
      userId: new Types.ObjectId(alice),
      deletedAt: null,
    },
    {
      _id: new Types.ObjectId(),
      name: 'Bob private',
      type: TransactionType.EXPENSE,
      userId: new Types.ObjectId(bob),
      deletedAt: null,
    },
    {
      _id: new Types.ObjectId(),
      name: 'Removed',
      type: TransactionType.EXPENSE,
      userId: new Types.ObjectId(alice),
      deletedAt: new Date(),
    },
  ];
  function document(record: RecordData): FakeDocument {
    return {
      ...record,
      id: scalar(record._id),
      toJSON: () => ({
        ...record,
        id: scalar(record._id),
        userId: record.userId ? scalar(record.userId) : null,
      }),
      save: () => Promise.resolve(document(record)),
    };
  }
  const categoryModel = {
    find: (filter: RecordData) => ({
      sort: () => ({
        exec: () =>
          Promise.resolve(
            records.filter((record) => matches(record, filter)).map(document),
          ),
      }),
    }),
    findOne: (filter: RecordData) => ({
      exec: () => {
        const found = records.find((record) => matches(record, filter));
        return Promise.resolve(found ? document(found) : null);
      },
    }),
    create: jest.fn((data: RecordData) => {
      const record = { ...data, _id: new Types.ObjectId(), deletedAt: null };
      records.push(record);
      return Promise.resolve(document(record));
    }),
  };
  const transactions = {
    exists: jest.fn(() => ({ exec: () => Promise.resolve(false) })),
  };
  const service = new CategoriesService(
    categoryModel as unknown as Model<CategoryDocument>,
    transactions as unknown as Model<Transaction>,
    {
      exists: () => ({ exec: () => Promise.resolve(null) }),
    } as unknown as Model<import('../budgets/budget.schema').Budget>,
    {
      exists: () => ({ exec: () => Promise.resolve(null) }),
    } as unknown as Model<
      import('../recurring-expenses/recurring-expense.schema').RecurringExpense
    >,
  );
  return { service, records, categoryModel, transactions };
}

describe('Personal category catalog', () => {
  it('returns only shared and owned categories, including legacy defaults, with type filtering', async () => {
    const { service } = fixture();
    expect(
      (await service.findVisible(alice)).map((category) => category.name),
    ).toEqual(['Food', 'Salary', 'Alice private']);
    expect(
      (await service.findVisible(bob, TransactionType.EXPENSE)).map(
        (category) => category.name,
      ),
    ).toEqual(['Food', 'Bob private']);
    // Personal lists must never contaminate the public catalog or its cache.
    expect((await service.findAll()).map((category) => category.name)).toEqual([
      'Food',
      'Salary',
    ]);
    await service.findVisible(bob);
    expect(
      (await service.findAll(TransactionType.INCOME)).map(
        (category) => category.name,
      ),
    ).toEqual(['Salary']);
  });

  it('trims input, assigns ownership, and permits the same personal name across accounts', async () => {
    const { service } = fixture();
    const payload = {
      name: '  Pet care  ',
      type: TransactionType.EXPENSE,
      icon: ' 🐾 ',
    };
    const first = await service.create(payload, alice);
    const second = await service.create(payload, bob);
    expect(first).toMatchObject({
      name: 'Pet care',
      icon: '🐾',
      userId: alice,
    });
    expect(second).toMatchObject({ name: 'Pet care', userId: bob });
    expect(first.id).not.toBe(second.id);
    expect(
      (await service.findAll()).some(
        (category) => category.name === 'Pet care',
      ),
    ).toBe(false);
  });

  it('rejects duplicate own and shared names within the same type', async () => {
    const { service } = fixture();
    for (const name of [' Food ', 'Alice private']) {
      await expect(
        service.create({ name, type: TransactionType.EXPENSE }, alice),
      ).rejects.toBeInstanceOf(ConflictException);
    }
    // The income and expense namespaces remain separate.
    await expect(
      service.create({ name: 'Food', type: TransactionType.INCOME }, alice),
    ).resolves.toMatchObject({ userId: alice });
    await expect(
      service.create({ name: 'Removed', type: TransactionType.EXPENSE }, alice),
    ).resolves.toMatchObject({ name: 'Removed' });
  });

  it('creates shared admin categories without an owner', async () => {
    const { service } = fixture();
    const shared = await service.create({
      name: 'Shared new',
      type: TransactionType.EXPENSE,
    });
    expect(shared.userId).toBeNull();
    expect(
      (await service.findVisible(bob)).map((category) => category.id),
    ).toContain(shared.id);
  });

  it('rejects blank names and maps concurrent duplicate inserts to a conflict', async () => {
    const { service, categoryModel } = fixture();
    await expect(
      service.create({ name: '   ', type: TransactionType.EXPENSE }, alice),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(categoryModel.create).not.toHaveBeenCalled();
    categoryModel.create.mockRejectedValueOnce({ code: 11000 });
    await expect(
      service.create(
        { name: 'Racing insert', type: TransactionType.EXPENSE },
        alice,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents public reads and shared-category admin mutations from reaching private categories', async () => {
    const { service, records, transactions } = fixture();
    const privateId = String(records[2]._id);
    await expect(service.findOne(privateId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update(privateId, { name: 'Changed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(privateId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(transactions.exists).not.toHaveBeenCalled();
    expect(records[2].name).toBe('Alice private');
    await expect(
      service.findOne(String(records[0]._id)),
    ).resolves.toMatchObject({ name: 'Food' });
  });
});

describe('Category index migration', () => {
  function fixture() {
    return {
      createIndex: jest.fn(() => Promise.resolve('userId_1_type_1_name_1')),
      indexes: jest.fn(() =>
        Promise.resolve<
          Awaited<ReturnType<import('mongoose').Collection['indexes']>>
        >([
          { name: '_id_', key: { _id: 1 } },
          { name: 'type_1_name_1', key: { type: 1, name: 1 } },
          {
            name: 'userId_1_type_1_name_1',
            key: { userId: 1, type: 1, name: 1 },
          },
        ]),
      ),
      dropIndex: jest.fn(() => Promise.resolve({})),
    };
  }

  it('creates owner-scoped uniqueness before removing only the legacy global index', async () => {
    const collection = fixture();
    await ensureCategoryOwnershipIndex(collection);
    expect(collection.createIndex).toHaveBeenCalledWith(
      { userId: 1, type: 1, name: 1 },
      { unique: true, partialFilterExpression: { deletedAt: null } },
    );
    expect(collection.dropIndex).toHaveBeenCalledWith('type_1_name_1');
    expect(collection.dropIndex).toHaveBeenCalledTimes(1);
    expect(collection.createIndex.mock.invocationCallOrder[0]).toBeLessThan(
      collection.dropIndex.mock.invocationCallOrder[0],
    );
    expect(CategorySchema.indexes()).toContainEqual([
      { userId: 1, type: 1, name: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });

  it('keeps the old index if creating its replacement fails', async () => {
    const collection = fixture();
    collection.createIndex.mockRejectedValueOnce(
      new Error('Index build failed'),
    );
    await expect(ensureCategoryOwnershipIndex(collection)).rejects.toThrow(
      'Index build failed',
    );
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it('handles simultaneous API startups but propagates real index errors', async () => {
    const collection = fixture();
    collection.dropIndex.mockRejectedValueOnce({ code: 27 });
    await expect(
      ensureCategoryOwnershipIndex(collection),
    ).resolves.toBeUndefined();
    collection.dropIndex.mockRejectedValueOnce({ code: 13 });
    await expect(ensureCategoryOwnershipIndex(collection)).rejects.toEqual({
      code: 13,
    });
  });
});
