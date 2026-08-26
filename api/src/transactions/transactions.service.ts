import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from '../categories/category.schema';
import { notDeleted } from '../common/schemas/schema.helpers';
import {
  TransactionTypeDocument,
  TransactionTypeEntity,
} from '../transaction-types/transaction-type.schema';
import { User, UserDocument } from '../users/user.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionType } from './transaction-type.enum';
import { Transaction, TransactionDocument } from './transaction.schema';

const TRANSACTION_POPULATE = ['user', 'category', 'transactionType'] as const;

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
  ): Promise<TransactionDocument[]> {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (year !== undefined && month !== undefined) {
      filter.date = {
        $gte: new Date(year, month, 1),
        $lte: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
    }

    return this.transactionModel
      .find(notDeleted(filter))
      .populate([...TRANSACTION_POPULATE])
      .sort({ date: -1 })
      .exec();
  }

  async findOne(id: string, userId: string): Promise<TransactionDocument> {
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

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionDocument> {
    const [user, category, transactionType] = await Promise.all([
      this.findUser(userId),
      this.findCategory(dto.categoryId),
      this.findTransactionType(dto.transactionTypeId),
    ]);
    this.ensureCategoryMatchesType(category, transactionType);

    const transaction = await this.transactionModel.create({
      userId: user._id,
      categoryId: category._id,
      transactionTypeId: transactionType._id,
      amount: dto.amount,
      description: dto.description,
      date: new Date(dto.date),
    });

    return this.findOne(transaction.id, userId);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionDocument> {
    const transaction = await this.findOne(id, userId);
    const [category, transactionType] = await Promise.all([
      dto.categoryId
        ? this.findCategory(dto.categoryId)
        : Promise.resolve(
            transaction.category as CategoryDocument | undefined,
          ).then(
            (c) => c ?? this.findCategory(transaction.categoryId.toString()),
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
      transaction.description = dto.description;
    if (dto.date !== undefined) transaction.date = new Date(dto.date);

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

  private async findUser(id: string): Promise<UserDocument> {
    const user = await this.userModel.findOne(notDeleted({ _id: id })).exec();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  private async findCategory(id: string): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findOne(notDeleted({ _id: id }))
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
