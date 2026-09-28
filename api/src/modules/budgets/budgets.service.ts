import { Injectable } from '@nestjs/common';
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

    const existing = await this.budgetModel
      .findOne(
        notDeleted({
          userId: ownerId,
          year: dto.year,
          month: dto.month,
          category,
        }),
      )
      .exec();

    if (existing) {
      existing.amount = dto.amount;
      return asPlain<Budget>(await existing.save());
    }

    const budget = await this.budgetModel.create({
      userId: ownerId,
      year: dto.year,
      month: dto.month,
      category,
      amount: dto.amount,
    });

    return asPlain<Budget>(budget);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.budgetModel
      .updateOne(
        notDeleted({ _id: id, userId: new Types.ObjectId(userId) }),
        { deletedAt: new Date() },
      )
      .exec();
  }
}
