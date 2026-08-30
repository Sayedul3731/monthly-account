import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from '../transactions/transaction.schema';
import {
  TransactionTypeEntity,
  TransactionTypeSchema,
} from './transaction-type.schema';
import { TransactionTypesController } from './transaction-types.controller';
import { TransactionTypesService } from './transaction-types.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TransactionTypeEntity.name, schema: TransactionTypeSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  controllers: [TransactionTypesController],
  providers: [TransactionTypesService],
})
export class TransactionTypesModule {}
