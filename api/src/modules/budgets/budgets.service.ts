import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { notDeleted } from '../../infrastructure/database/schema.helpers';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { Budget, BudgetDocument } from './budget.schema';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name)
    private readonly budgetModel: Model<BudgetDocument>,
  ) {}

  findAll(year: number, month: number): Promise<Budget[]> {
    return this.budgetModel
      .find(notDeleted({ year, month }))
      .sort({ category: 1 })
      .exec();
  }

  async upsert(dto: UpsertBudgetDto): Promise<BudgetDocument> {
    const category = dto.category?.trim() ? dto.category.trim() : '';

    const existing = await this.budgetModel
      .findOne(notDeleted({ year: dto.year, month: dto.month, category }))
      .exec();

    if (existing) {
      existing.amount = dto.amount;
      return existing.save();
    }

    return this.budgetModel.create({
      year: dto.year,
      month: dto.month,
      category,
      amount: dto.amount,
    });
  }

  async remove(id: string): Promise<void> {
    await this.budgetModel
      .updateOne(notDeleted({ _id: id }), { deletedAt: new Date() })
      .exec();
  }
}
