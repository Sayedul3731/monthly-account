import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
    ]),
  ],
  controllers: [TransactionTypesController],
  providers: [TransactionTypesService],
})
export class TransactionTypesModule {}
