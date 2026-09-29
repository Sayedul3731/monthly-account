import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../infrastructure/database/schema.helpers';
import { User } from '../users/user.schema';

export type AuditEventDocument = HydratedDocument<AuditEvent>;

/** Immutable, non-sensitive record of privileged changes. */
@Schema({ ...baseSchemaOptions, collection: 'audit_events' })
export class AuditEvent {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  actorId!: Types.ObjectId;

  @Prop({ required: true, maxlength: 80 })
  action!: string;

  @Prop({ required: true, maxlength: 255 })
  resource!: string;

  @Prop({ required: true, min: 100, max: 599 })
  statusCode!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);
AuditEventSchema.index({ createdAt: -1 });
AuditEventSchema.index({ actorId: 1, createdAt: -1 });
