import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../../infrastructure/database/schema.helpers';

export type TransactionTypeDocument = HydratedDocument<TransactionTypeEntity>;

@Schema({ ...baseSchemaOptions, collection: 'transaction_types' })
export class TransactionTypeEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'income', maxLength: 50 })
  @Prop({ required: true, maxlength: 50 })
  name!: string;

  @ApiProperty({ example: 'Income', maxLength: 50 })
  @Prop({ required: true, maxlength: 50 })
  label!: string;

  @ApiPropertyOptional({ example: '💰', maxLength: 10 })
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

export const TransactionTypeSchema = SchemaFactory.createForClass(
  TransactionTypeEntity,
);

TransactionTypeSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
