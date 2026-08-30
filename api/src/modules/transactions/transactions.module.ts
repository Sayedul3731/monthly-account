import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../categories/category.schema';
import {
  TransactionTypeEntity,
  TransactionTypeSchema,
} from '../transaction-types/transaction-type.schema';
import { User, UserSchema } from '../users/user.schema';
import { Transaction, TransactionSchema } from './transaction.schema';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: Category.name, schema: CategorySchema },
      { name: TransactionTypeEntity.name, schema: TransactionTypeSchema },
    ]),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
