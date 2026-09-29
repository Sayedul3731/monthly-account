import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RateLimitRecordDocument = HydratedDocument<RateLimitRecord>;

@Schema({ collection: 'rate_limit_records', versionKey: false })
export class RateLimitRecord {
  @Prop({ required: true, unique: true, index: true })
  key!: string;

  @Prop({ required: true, default: 0 })
  totalHits!: number;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  blockExpiresAt!: Date | null;

  /** TTL index automatically removes the record after the window/block ends. */
  @Prop({ required: true, index: { expireAfterSeconds: 0 } })
  cleanupAt!: Date;
}

export const RateLimitRecordSchema = SchemaFactory.createForClass(RateLimitRecord);
