import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../common/schemas/schema.helpers';
import { MembershipType } from './membership-type.enum';

export type MembershipDocument = HydratedDocument<Membership>;

@Schema({ ...baseSchemaOptions, collection: 'memberships' })
export class Membership {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Free', maxLength: 50 })
  @Prop({ required: true, maxlength: 50 })
  name!: string;

  @ApiProperty({ enum: MembershipType, example: MembershipType.FREE })
  @Prop({ required: true, enum: MembershipType })
  type!: MembershipType;

  @ApiPropertyOptional({
    example: 'Track income, expenses, and budgets at no cost.',
    maxLength: 255,
  })
  @Prop({ type: String, default: null, maxlength: 255 })
  description!: string | null;

  @ApiProperty({
    example: 1,
    description: 'Monthly price in USD. 0 for free.',
  })
  @Prop({ required: true, default: 0, min: 0 })
  monthlyPrice!: number;

  @ApiProperty({
    example: 6,
    description: 'Yearly price in USD. 0 for free.',
  })
  @Prop({ required: true, default: 0, min: 0 })
  yearlyPrice!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

MembershipSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

MembershipSchema.index(
  { type: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
