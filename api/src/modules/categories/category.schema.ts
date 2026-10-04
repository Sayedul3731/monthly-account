import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../infrastructure/database/schema.helpers';
import { TransactionType } from '../transactions/transaction-type.enum';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ ...baseSchemaOptions, collection: 'categories' })
export class Category {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Owner; null for shared categories',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId!: Types.ObjectId | null;

  @ApiProperty({ example: 'Food', maxLength: 100 })
  @Prop({ required: true, maxlength: 100 })
  name!: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @Prop({ type: String, required: true, enum: TransactionType })
  type!: TransactionType;

  @ApiPropertyOptional({ example: '🍔', maxLength: 10 })
  @Prop({ default: '', maxlength: 10 })
  icon!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index(
  { userId: 1, type: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
