import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  asPlain,
  asPlainList,
  notDeleted,
} from '../../infrastructure/database/schema.helpers';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { Budget, BudgetDocument } from './budget.schema';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name)
    private readonly budgetModel: Model<BudgetDocument>,
  ) {}

  async findAll(
    userId: string,
    year: number,
    month: number,
  ): Promise<Budget[]> {
    const budgets = await this.budgetModel
      .find(notDeleted({ userId: new Types.ObjectId(userId), year, month }))
      .sort({ category: 1 })
      .exec();

    return asPlainList<Budget>(budgets);
  }

  async upsert(userId: string, dto: UpsertBudgetDto): Promise<Budget> {
    const category = dto.category?.trim() ? dto.category.trim() : '';
    const ownerId = new Types.ObjectId(userId);
    const filter = notDeleted({
      userId: ownerId,
      year: dto.year,
      month: dto.month,
      category,
    });
    const update = { $set: { amount: dto.amount } };
    let budget: BudgetDocument | null;
    try {
      budget = await this.budgetModel
        .findOneAndUpdate(filter, update, {
          upsert: true,
          returnDocument: 'after',
          runValidators: true,
        })
        .exec();
    } catch (error: unknown) {
      if (
        !(
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 11000
        )
      )
        throw error;
      budget = await this.budgetModel
        .findOneAndUpdate(filter, update, {
          returnDocument: 'after',
          runValidators: true,
        })
        .exec();
    }
    if (!budget) throw new NotFoundException('Budget could not be saved');
    return asPlain<Budget>(budget);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.budgetModel
      .updateOne(notDeleted({ _id: id, userId: new Types.ObjectId(userId) }), {
        deletedAt: new Date(),
      })
      .exec();
  }
}
