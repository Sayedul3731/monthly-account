import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  asPlain,
  asPlainList,
  notDeleted,
} from '../../infrastructure/database/schema.helpers';
import { parseCalendarDate } from '../../shared/dates';
import { Category, CategoryDocument } from '../categories/category.schema';
import {
  TransactionTypeEntity,
  TransactionTypeDocument,
} from '../transaction-types/transaction-type.schema';
import { TransactionType } from '../transactions/transaction-type.enum';
import {
  Transaction,
  TransactionDocument,
} from '../transactions/transaction.schema';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto';
import {
  RecurringExpense,
  RecurringExpenseDocument,
} from './recurring-expense.schema';

@Injectable()
export class RecurringExpensesService {
  constructor(
    @InjectModel(RecurringExpense.name)
    private readonly recurringExpenseModel: Model<RecurringExpenseDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(TransactionTypeEntity.name)
    private readonly transactionTypeModel: Model<TransactionTypeDocument>,
  ) {}

  async findAll(userId: string): Promise<RecurringExpense[]> {
    const schedules = await this.recurringExpenseModel
      .find(notDeleted({ userId: new Types.ObjectId(userId) }))
      .sort({ active: -1, createdAt: -1 })
      .populate('category')
      .exec();
    return asPlainList<RecurringExpense>(schedules);
  }

  async create(
    userId: string,
    dto: CreateRecurringExpenseDto,
  ): Promise<RecurringExpense> {
    const [category, expenseType] = await Promise.all([
      this.categoryModel.findOne(notDeleted({ _id: dto.categoryId })).exec(),
      this.transactionTypeModel
        .findOne(notDeleted({ name: TransactionType.EXPENSE }))
        .exec(),
    ]);
    if (!category)
      throw new NotFoundException(`Category ${dto.categoryId} not found`);
    if (category.type !== TransactionType.EXPENSE) {
      throw new BadRequestException(
        'Recurring schedules can only use an expense category',
      );
    }
    if (!expenseType)
      throw new NotFoundException('Expense transaction type not found');

    const schedule = await this.recurringExpenseModel.create({
      userId: new Types.ObjectId(userId),
      categoryId: category._id,
      transactionTypeId: expenseType._id,
      amount: dto.amount,
      description: dto.description?.trim() || null,
      dayOfMonth: dto.dayOfMonth,
      startsOn: parseCalendarDate(
        dto.startsOn ?? new Date().toISOString().slice(0, 10),
      ),
      active: true,
    });
    return this.findOne(schedule.id, userId);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateRecurringExpenseDto,
  ): Promise<RecurringExpense> {
    const schedule = await this.getOwned(id, userId);
    if (dto.categoryId) {
      const category = await this.categoryModel
        .findOne(notDeleted({ _id: dto.categoryId }))
        .exec();
      if (!category)
        throw new NotFoundException(`Category ${dto.categoryId} not found`);
      if (category.type !== TransactionType.EXPENSE) {
        throw new BadRequestException(
          'Recurring schedules can only use an expense category',
        );
      }
      schedule.categoryId = category._id;
    }
    if (dto.amount !== undefined) schedule.amount = dto.amount;
    if (dto.description !== undefined)
      schedule.description = dto.description?.trim() || null;
    if (dto.dayOfMonth !== undefined) schedule.dayOfMonth = dto.dayOfMonth;
    if (dto.startsOn !== undefined)
      schedule.startsOn = parseCalendarDate(dto.startsOn);
    if (dto.active !== undefined) schedule.active = dto.active;
    await schedule.save();
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const result = await this.recurringExpenseModel
      .updateOne(notDeleted({ _id: id, userId: new Types.ObjectId(userId) }), {
        deletedAt: new Date(),
        active: false,
      })
      .exec();
    if (!result.matchedCount)
      throw new NotFoundException(`Recurring expense ${id} not found`);
  }

  async generateForMonth(
    userId: string,
    year: number,
    month: number,
  ): Promise<void> {
    const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    const schedules = await this.recurringExpenseModel
      .find({
        ...notDeleted({ userId: new Types.ObjectId(userId), active: true }),
        startsOn: { $lte: monthEnd },
      })
      .exec();
    if (!schedules.length) return;

    const recurringPeriod = `${year}-${String(month + 1).padStart(2, '0')}`;

    await this.transactionModel.bulkWrite(
      schedules.map((schedule) => {
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const date = new Date(
          Date.UTC(year, month, Math.min(schedule.dayOfMonth, lastDay), 12),
        );
        return {
          updateOne: {
            filter: { recurringExpenseId: schedule._id, recurringPeriod },
            update: {
              $setOnInsert: {
                userId: schedule.userId,
                categoryId: schedule.categoryId,
                transactionTypeId: schedule.transactionTypeId,
                amount: schedule.amount,
                description: schedule.description,
                date,
                recurringExpenseId: schedule._id,
                recurringPeriod,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }

  private async findOne(id: string, userId: string): Promise<RecurringExpense> {
    const schedule = await this.recurringExpenseModel
      .findOne(notDeleted({ _id: id, userId: new Types.ObjectId(userId) }))
      .populate('category')
      .exec();
    if (!schedule)
      throw new NotFoundException(`Recurring expense ${id} not found`);
    return asPlain<RecurringExpense>(schedule);
  }

  private async getOwned(
    id: string,
    userId: string,
  ): Promise<RecurringExpenseDocument> {
    const schedule = await this.recurringExpenseModel
      .findOne(notDeleted({ _id: id, userId: new Types.ObjectId(userId) }))
      .exec();
    if (!schedule)
      throw new NotFoundException(`Recurring expense ${id} not found`);
    return schedule;
  }
}
