import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { Category } from '../categories/category.schema';
import { baseSchemaOptions } from '../../infrastructure/database/schema.helpers';
import { TransactionTypeEntity } from '../transaction-types/transaction-type.schema';
import { User } from '../users/user.schema';

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ ...baseSchemaOptions, collection: 'transactions' })
export class Transaction {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @ApiProperty({ type: User })
  user?: User;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: Category.name, required: true })
  categoryId!: Types.ObjectId;

  @ApiProperty({ type: Category })
  category?: Category;

  @ApiProperty()
  @Prop({
    type: Types.ObjectId,
    ref: TransactionTypeEntity.name,
    required: true,
  })
  transactionTypeId!: Types.ObjectId;

  @ApiProperty({ type: TransactionTypeEntity })
  transactionType?: TransactionTypeEntity;

  @Prop({ type: Types.ObjectId, ref: 'RecurringExpense', default: null })
  recurringExpenseId?: Types.ObjectId | null;

  /** YYYY-MM marker used to ensure one generated entry per schedule per month. */
  @Prop({ type: String, default: null })
  recurringPeriod?: string | null;

  @ApiProperty({ example: 49.99 })
  @Prop({ required: true })
  amount!: number;

  @ApiProperty({ example: 'Weekly groceries', nullable: true })
  @Prop({ type: String, default: null, maxlength: 255 })
  description!: string | null;

  @ApiProperty({ format: 'date-time' })
  @Prop({ required: true, type: Date })
  date!: Date;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.virtual('user', {
  ref: User.name,
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

TransactionSchema.virtual('category', {
  ref: Category.name,
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true,
});

TransactionSchema.virtual('transactionType', {
  ref: TransactionTypeEntity.name,
  localField: 'transactionTypeId',
  foreignField: '_id',
  justOne: true,
});

TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, deletedAt: 1, date: -1 });
TransactionSchema.index(
  { recurringExpenseId: 1, recurringPeriod: 1 },
  {
    unique: true,
    partialFilterExpression: { recurringExpenseId: { $type: 'objectId' } },
  },
);
