import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../infrastructure/database/schema.helpers';
import { User } from '../users/user.schema';
import { NotificationType } from './notification-type.enum';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ ...baseSchemaOptions, collection: 'notifications' })
export class Notification {
  @ApiProperty()
  id!: string;

  @ApiHideProperty()
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @ApiProperty({ enum: NotificationType })
  @Prop({ type: String, enum: NotificationType, required: true })
  type!: NotificationType;

  @ApiProperty({ maxLength: 120 })
  @Prop({ required: true, maxlength: 120 })
  title!: string;

  @ApiProperty({ maxLength: 500 })
  @Prop({ required: true, maxlength: 500 })
  message!: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @Prop({ type: String, default: null, maxlength: 255 })
  link!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  readAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiHideProperty()
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
