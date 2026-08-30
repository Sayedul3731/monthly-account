import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../infrastructure/database/schema.helpers';
import { BillingInterval } from '../memberships/billing-interval.enum';
import { Membership } from '../memberships/membership.schema';
import { AppRole } from '../roles/app-role.schema';

export type UserDocument = HydratedDocument<User>;

@Schema({ ...baseSchemaOptions, collection: 'users' })
export class User {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @Prop({ required: true, maxlength: 100 })
  name!: string;

  @ApiProperty({ example: 'jane@example.com' })
  @Prop({ required: true, maxlength: 255 })
  email!: string;

  @ApiHideProperty()
  @Exclude()
  @Prop({ required: true, select: false })
  password?: string;

  @ApiHideProperty()
  @Exclude()
  @Prop({ type: String, select: false, default: null })
  refreshToken?: string | null;

  @ApiHideProperty()
  @Prop({ type: Types.ObjectId, ref: AppRole.name, required: true })
  roleId!: Types.ObjectId;

  @ApiProperty({ type: AppRole })
  role?: AppRole;

  @ApiHideProperty()
  @Prop({ type: Types.ObjectId, ref: Membership.name, required: true })
  membershipId!: Types.ObjectId;

  @ApiProperty({ type: Membership })
  membership?: Membership;

  @ApiPropertyOptional({
    enum: BillingInterval,
    nullable: true,
    description: 'Billing interval for a paid membership. Null on the free plan.',
  })
  @Prop({ type: String, enum: BillingInterval, default: null })
  billingInterval!: BillingInterval | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('role', {
  ref: AppRole.name,
  localField: 'roleId',
  foreignField: '_id',
  justOne: true,
});

UserSchema.virtual('membership', {
  ref: Membership.name,
  localField: 'membershipId',
  foreignField: '_id',
  justOne: true,
});

UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
