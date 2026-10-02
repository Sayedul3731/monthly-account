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

  // Existing and administrator-created accounts do not need first-run setup.
  // Self-service registration explicitly opts new accounts into onboarding.
  @ApiProperty({ enum: ['pending', 'completed', 'skipped'] })
  @Prop({
    type: String,
    enum: ['pending', 'completed', 'skipped'],
    default: 'completed',
  })
  onboardingStatus!: 'pending' | 'completed' | 'skipped';

  @ApiProperty({ minimum: 0, maximum: 4 })
  @Prop({ type: Number, min: 0, max: 4, default: 0 })
  onboardingStep!: number;

  @ApiPropertyOptional({ example: '2026-10', nullable: true })
  @Prop({ type: String, default: null })
  onboardingPeriod!: string | null;

  @ApiProperty({ example: 'jane@example.com' })
  @Prop({ required: true, maxlength: 255 })
  email!: string;

  @ApiHideProperty()
  @Exclude()
  @Prop({ select: false })
  password?: string;

  @ApiHideProperty()
  @Exclude()
  @Prop({ type: String, select: false, sparse: true, unique: true })
  googleId?: string;

  @ApiHideProperty()
  @Exclude()
  @Prop({ type: String, select: false, default: null })
  refreshToken?: string | null;

  @ApiHideProperty()
  @Exclude()
  @Prop({ type: String, select: false, default: null })
  pendingEmail?: string | null;

  @ApiHideProperty()
  @Exclude()
  @Prop({ type: String, select: false, default: null })
  emailChangeTokenHash?: string | null;

  @ApiHideProperty()
  @Exclude()
  @Prop({ type: Date, select: false, default: null })
  emailChangeExpiresAt?: Date | null;

  @ApiHideProperty()
  @Exclude()
  @Prop({ type: String, select: false, default: null })
  oauthHandoffHash?: string | null;

  @ApiHideProperty()
  @Exclude()
  @Prop({ type: Date, select: false, default: null })
  oauthHandoffExpiresAt?: Date | null;

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
    description:
      'Billing interval for a paid membership. Null on the free plan.',
  })
  @Prop({ type: String, enum: BillingInterval, default: null })
  billingInterval!: BillingInterval | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  trialStartedAt!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  trialEndsAt!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  planStartedAt!: Date | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  planEndsAt!: Date | null;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'When the user cancelled renewal of the current paid period.',
  })
  @Prop({ type: Date, default: null })
  cancelledAt!: Date | null;

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
