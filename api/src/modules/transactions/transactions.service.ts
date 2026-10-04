import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from '../categories/category.schema';
import { visibleCategories } from '../categories/category-access';
import { parseCalendarDate, utcMonthRange } from '../../shared/dates';
import {
  asPlain,
  notDeleted,
} from '../../infrastructure/database/schema.helpers';
import {
  TransactionTypeDocument,
  TransactionTypeEntity,
} from '../transaction-types/transaction-type.schema';
import { User, UserDocument } from '../users/user.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionType } from './transaction-type.enum';
import { Transaction, TransactionDocument } from './transaction.schema';

const TRANSACTION_POPULATE = ['category', 'transactionType'] as const;

type AggregateTransaction = Omit<
  Transaction,
  'id' | 'category' | 'transactionType'
> & {
  _id: Types.ObjectId;
  category?: Omit<Category, 'id'> & { _id: Types.ObjectId };
  transactionType?: Omit<TransactionTypeEntity, 'id'> & {
    _id: Types.ObjectId;
  };
};

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(TransactionTypeEntity.name)
    private readonly transactionTypeModel: Model<TransactionTypeDocument>,
  ) {}

  async findAll(
    userId: string,
    year?: number,
    month?: number,
    start?: string,
    end?: string,
  ): Promise<Transaction[]> {
    const docs = await this.findDocuments(userId, year, month, start, end);
    return docs.map((document) => this.toTransaction(document));
  }

  async findOne(id: string, userId: string): Promise<Transaction> {
    return asPlain<Transaction>(await this.getOwned(id, userId));
  }

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    const [user, category, transactionType] = await Promise.all([
      this.findUser(userId),
      this.findCategory(dto.categoryId, userId),
      this.findTransactionType(dto.transactionTypeId),
    ]);
    this.ensureCategoryMatchesType(category, transactionType);

    const transaction = await this.transactionModel.create({
      userId: user._id,
      categoryId: category._id,
      transactionTypeId: transactionType._id,
      amount: dto.amount,
      description: dto.description?.trim() || null,
      date: parseCalendarDate(dto.date),
    });

    return this.findOne(transaction.id, userId);
  }

  async findOnboardingEntries(userId: string): Promise<Transaction[]> {
    const entries = await this.transactionModel
      .find(
        notDeleted({
          userId: new Types.ObjectId(userId),
          onboardingKind: { $in: ['income', 'expense'] as const },
        }),
      )
      .populate([...TRANSACTION_POPULATE])
      .exec();
    return entries.map((entry) => asPlain<Transaction>(entry));
  }

  async saveOnboardingEntry(
    userId: string,
    kind: TransactionType,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    const [user, category, transactionType] = await Promise.all([
      this.findUser(userId),
      this.findCategory(dto.categoryId, userId),
      this.findTransactionType(dto.transactionTypeId),
    ]);
    if (user.onboardingStatus !== 'pending') {
      throw new ConflictException(
        'Setup is already finished. Edit this entry from your transactions.',
      );
    }
    const date = parseCalendarDate(dto.date);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dto.date) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dto.date ||
      !user.onboardingPeriod ||
      dto.date.slice(0, 7) !== user.onboardingPeriod
    ) {
      throw new BadRequestException(
        'Choose a valid date in the month being set up.',
      );
    }
    if (String(transactionType.name) !== String(kind)) {
      throw new BadRequestException(
        'Transaction type does not match this setup step.',
      );
    }
    this.ensureCategoryMatchesType(category, transactionType);

    const filter = { userId: user._id, onboardingKind: kind };
    const update = {
      $set: {
        categoryId: category._id,
        transactionTypeId: transactionType._id,
        amount: dto.amount,
        description: dto.description?.trim() || null,
        date,
        deletedAt: null,
      },
    };
    let transaction: TransactionDocument | null;
    try {
      transaction = await this.transactionModel
        .findOneAndUpdate(filter, update, {
          upsert: true,
          new: true,
          runValidators: true,
        })
        .exec();
    } catch (error: unknown) {
      // Two first submissions can race. The unique index permits one entry;
      // apply the retry to that entry instead of inserting another transaction.
      if (
        !(
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 11000
        )
      )
        throw error;
      transaction = await this.transactionModel
        .findOneAndUpdate(filter, update, { new: true, runValidators: true })
        .exec();
    }
    if (!transaction)
      throw new NotFoundException('Setup transaction not found');
    return this.findOne(transaction.id, userId);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const transaction = await this.getOwned(id, userId);
    const [category, transactionType] = await Promise.all([
      this.findCategory(
        dto.categoryId ?? transaction.categoryId.toString(),
        userId,
      ),
      dto.transactionTypeId
        ? this.findTransactionType(dto.transactionTypeId)
        : Promise.resolve(
            transaction.transactionType as TransactionTypeDocument | undefined,
          ).then(
            (t) =>
              t ??
              this.findTransactionType(
                transaction.transactionTypeId.toString(),
              ),
          ),
    ]);
    this.ensureCategoryMatchesType(category, transactionType);

    transaction.categoryId = category._id;
    transaction.transactionTypeId = transactionType._id;
    if (dto.amount !== undefined) transaction.amount = dto.amount;
    if (dto.description !== undefined)
      transaction.description = dto.description?.trim() || null;
    if (dto.date !== undefined) transaction.date = parseCalendarDate(dto.date);

    await transaction.save();

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.transactionModel
      .updateOne(
        notDeleted({
          _id: id,
          userId: new Types.ObjectId(userId),
        }),
        { deletedAt: new Date() },
      )
      .exec();

    if (!result.matchedCount) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
  }

  async getSummary(userId: string, year: number, month: number) {
    const transactions = await this.findAll(userId, year, month);

    const income = transactions
      .filter((t) => t.transactionType?.name === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter((t) => t.transactionType?.name === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expenses;

    return {
      income,
      expenses,
      balance,
      savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
      count: transactions.length,
    };
  }

  private async findDocuments(
    userId: string,
    year?: number,
    month?: number,
    start?: string,
    end?: string,
  ): Promise<AggregateTransaction[]> {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (year !== undefined && month !== undefined) {
      filter.date = utcMonthRange(year, month);
    } else if (start !== undefined && end !== undefined) {
      filter.date = {
        $gte: parseCalendarDate(start),
        $lte: new Date(`${end}T23:59:59.999Z`),
      };
    }

    return this.transactionModel
      .aggregate<AggregateTransaction>([
        { $match: notDeleted(filter) },
        { $sort: { date: -1 } },
        {
          $lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $unwind: {
            path: '$category',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'transaction_types',
            localField: 'transactionTypeId',
            foreignField: '_id',
            as: 'transactionType',
          },
        },
        {
          $unwind: {
            path: '$transactionType',
            preserveNullAndEmptyArrays: true,
          },
        },
      ])
      .exec();
  }

  private toTransaction(document: AggregateTransaction): Transaction {
    const { _id, category, transactionType, ...transaction } = document;

    return {
      ...transaction,
      id: _id.toString(),
      userId: transaction.userId.toString(),
      categoryId: transaction.categoryId.toString(),
      transactionTypeId: transaction.transactionTypeId.toString(),
      category: category
        ? { ...category, id: category._id.toString() }
        : undefined,
      transactionType: transactionType
        ? { ...transactionType, id: transactionType._id.toString() }
        : undefined,
    } as unknown as Transaction;
  }

  private async getOwned(
    id: string,
    userId: string,
  ): Promise<TransactionDocument> {
    const transaction = await this.transactionModel
      .findOne(
        notDeleted({
          _id: id,
          userId: new Types.ObjectId(userId),
        }),
      )
      .populate([...TRANSACTION_POPULATE])
      .exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    return transaction;
  }

  private async findUser(id: string): Promise<UserDocument> {
    const user = await this.userModel.findOne(notDeleted({ _id: id })).exec();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  private async findCategory(
    id: string,
    userId: string,
  ): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findOne(notDeleted({ _id: id, ...visibleCategories(userId) }))
      .exec();
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  private async findTransactionType(
    id: string,
  ): Promise<TransactionTypeDocument> {
    const transactionType = await this.transactionTypeModel
      .findOne(notDeleted({ _id: id }))
      .exec();
    if (!transactionType) {
      throw new NotFoundException(`Transaction type ${id} not found`);
    }
    return transactionType;
  }

  private ensureCategoryMatchesType(
    category: Category,
    transactionType: TransactionTypeEntity,
  ): void {
    if (String(category.type) !== String(transactionType.name)) {
      throw new BadRequestException(
        `Category "${category.name}" is not valid for transaction type "${transactionType.name}"`,
      );
    }
  }
}
