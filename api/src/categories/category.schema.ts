import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../common/schemas/schema.helpers';
import { TransactionType } from '../transactions/transaction-type.enum';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ ...baseSchemaOptions, collection: 'categories' })
export class Category {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Food', maxLength: 100 })
  @Prop({ required: true, maxlength: 100 })
  name!: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @Prop({ required: true, enum: TransactionType })
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
  { type: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
