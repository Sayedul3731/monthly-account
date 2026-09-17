import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../infrastructure/database/schema.helpers';
import { BillingInterval } from '../memberships/billing-interval.enum';
import { Membership } from '../memberships/membership.schema';
import { User } from '../users/user.schema';
import { ManualPaymentStatus } from './manual-payment-status.enum';

export type ManualPaymentDocument = HydratedDocument<ManualPayment>;

@Schema({ ...baseSchemaOptions, collection: 'manual_payments' })
export class ManualPayment {
  @ApiProperty()
  id!: string;

  @ApiHideProperty()
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @ApiPropertyOptional({ type: User })
  user?: User;

  @ApiHideProperty()
  @Prop({ type: Types.ObjectId, ref: Membership.name, required: true })
  membershipId!: Types.ObjectId;

  @ApiProperty({ type: Membership })
  membership?: Membership;

  @ApiProperty({ enum: BillingInterval })
  @Prop({ type: String, enum: BillingInterval, required: true })
  billingInterval!: BillingInterval;

  @ApiProperty({
    example: 399,
    description: 'Locked BDT amount at submission.',
  })
  @Prop({ required: true, min: 0.01 })
  amount!: number;

  @ApiProperty({ example: 'BDT' })
  @Prop({ type: String, default: 'BDT', immutable: true })
  currency!: 'BDT';

  @ApiProperty({ example: 'Nagad' })
  @Prop({ type: String, default: 'Nagad', immutable: true })
  method!: 'Nagad';

  @ApiProperty({ example: 'A1B2C3D4E5', maxLength: 100 })
  @Prop({ required: true, trim: true, uppercase: true, maxlength: 100 })
  transactionId!: string;

  @ApiProperty({ enum: ManualPaymentStatus })
  @Prop({
    type: String,
    enum: ManualPaymentStatus,
    default: ManualPaymentStatus.PENDING,
  })
  status!: ManualPaymentStatus;

  @ApiHideProperty()
  @Prop({ type: Types.ObjectId, ref: User.name, default: null })
  reviewedById!: Types.ObjectId | null;

  @ApiPropertyOptional({ type: User })
  reviewedBy?: User | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  reviewedAt!: Date | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @Prop({ type: String, default: null, maxlength: 500 })
  reviewNote!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiHideProperty()
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const ManualPaymentSchema = SchemaFactory.createForClass(ManualPayment);

ManualPaymentSchema.virtual('user', {
  ref: User.name,
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

ManualPaymentSchema.virtual('membership', {
  ref: Membership.name,
  localField: 'membershipId',
  foreignField: '_id',
  justOne: true,
});

ManualPaymentSchema.virtual('reviewedBy', {
  ref: User.name,
  localField: 'reviewedById',
  foreignField: '_id',
  justOne: true,
});

ManualPaymentSchema.index(
  { transactionId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
ManualPaymentSchema.index({ userId: 1, status: 1, createdAt: -1 });
ManualPaymentSchema.index({ status: 1, createdAt: -1 });
