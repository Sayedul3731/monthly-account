import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

  async findAll(year: number, month: number): Promise<Budget[]> {
    const budgets = await this.budgetModel
      .find(notDeleted({ year, month }))
      .sort({ category: 1 })
      .exec();

    return asPlainList<Budget>(budgets);
  }

  async upsert(dto: UpsertBudgetDto): Promise<Budget> {
    const category = dto.category?.trim() ? dto.category.trim() : '';

    const existing = await this.budgetModel
      .findOne(notDeleted({ year: dto.year, month: dto.month, category }))
      .exec();

    if (existing) {
      existing.amount = dto.amount;
      return asPlain<Budget>(await existing.save());
    }

    const budget = await this.budgetModel.create({
      year: dto.year,
      month: dto.month,
      category,
      amount: dto.amount,
    });

    return asPlain<Budget>(budget);
  }

  async remove(id: string): Promise<void> {
    await this.budgetModel
      .updateOne(notDeleted({ _id: id }), { deletedAt: new Date() })
      .exec();
  }
}
