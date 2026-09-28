import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../infrastructure/database/schema.helpers';
import { User } from '../users/user.schema';

export type BudgetDocument = HydratedDocument<Budget>;

@Schema({ ...baseSchemaOptions, collection: 'budgets' })
export class Budget {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @ApiProperty({ example: 2026 })
  @Prop({ required: true })
  year!: number;

  @ApiProperty({ example: 5, description: 'Zero-based month (0 = January)' })
  @Prop({ required: true })
  month!: number;

  @ApiPropertyOptional({
    example: 'Food',
    description: 'Empty string means overall monthly budget',
  })
  @Prop({ default: '', maxlength: 100 })
  category!: string;

  @ApiProperty({ example: 500 })
  @Prop({ required: true })
  amount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const BudgetSchema = SchemaFactory.createForClass(Budget);

BudgetSchema.index(
  { userId: 1, year: 1, month: 1, category: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
