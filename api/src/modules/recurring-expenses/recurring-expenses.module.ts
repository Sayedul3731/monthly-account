import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../categories/category.schema';
import {
  TransactionTypeEntity,
  TransactionTypeSchema,
} from '../transaction-types/transaction-type.schema';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/transaction.schema';
import { RecurringExpensesController } from './recurring-expenses.controller';
import {
  RecurringExpense,
  RecurringExpenseSchema,
} from './recurring-expense.schema';
import { RecurringExpensesService } from './recurring-expenses.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RecurringExpense.name, schema: RecurringExpenseSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Category.name, schema: CategorySchema },
      { name: TransactionTypeEntity.name, schema: TransactionTypeSchema },
    ]),
  ],
  controllers: [RecurringExpensesController],
  providers: [RecurringExpensesService],
  exports: [RecurringExpensesService],
})
export class RecurringExpensesModule {}
