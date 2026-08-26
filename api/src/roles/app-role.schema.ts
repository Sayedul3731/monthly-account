import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../common/schemas/schema.helpers';

export enum DefaultRole {
  ADMIN = 'admin',
  USER = 'user',
}

export type AppRoleDocument = HydratedDocument<AppRole>;

@Schema({ ...baseSchemaOptions, collection: 'app_roles' })
export class AppRole {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: DefaultRole.USER, maxLength: 50 })
  @Prop({ required: true, maxlength: 50 })
  name!: string;

  @ApiPropertyOptional({ example: 'Standard application user' })
  @Prop({ type: String, default: null, maxlength: 255 })
  description!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const AppRoleSchema = SchemaFactory.createForClass(AppRole);

AppRoleSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
