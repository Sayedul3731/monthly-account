import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../infrastructure/database/schema.helpers';
import { Category } from '../categories/category.schema';
import { TransactionTypeEntity } from '../transaction-types/transaction-type.schema';
import { User } from '../users/user.schema';

export type RecurringExpenseDocument = HydratedDocument<RecurringExpense>;

@Schema({ ...baseSchemaOptions, collection: 'recurring_expenses' })
export class RecurringExpense {
  @ApiProperty()
  id!: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: Category.name, required: true })
  categoryId!: Types.ObjectId;

  @ApiProperty({ type: Category })
  category?: Category;

  @Prop({
    type: Types.ObjectId,
    ref: TransactionTypeEntity.name,
    required: true,
  })
  transactionTypeId!: Types.ObjectId;

  @ApiProperty({ example: 15000 })
  @Prop({ required: true })
  amount!: number;

  @ApiPropertyOptional({ example: 'Monthly rent', nullable: true })
  @Prop({ type: String, default: null, maxlength: 255 })
  description!: string | null;

  @ApiProperty({ example: 1, minimum: 1, maximum: 31 })
  @Prop({ required: true, min: 1, max: 31, default: 1 })
  dayOfMonth!: number;

  @ApiProperty({ format: 'date' })
  @Prop({ required: true, type: Date })
  startsOn!: Date;

  @ApiProperty()
  @Prop({ default: true })
  active!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const RecurringExpenseSchema =
  SchemaFactory.createForClass(RecurringExpense);

RecurringExpenseSchema.virtual('category', {
  ref: Category.name,
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true,
});

RecurringExpenseSchema.index({ userId: 1, active: 1, deletedAt: 1 });
