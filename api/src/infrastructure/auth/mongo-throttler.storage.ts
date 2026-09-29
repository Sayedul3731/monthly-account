import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Model } from 'mongoose';
import { RateLimitRecord, type RateLimitRecordDocument } from './rate-limit-record.schema';

/**
 * Mongo-backed storage makes rate limiting effective across serverless
 * instances. It deliberately stores only the framework's hashed throttle key,
 * never an IP address, email address, or access token.
 */
@Injectable()
export class MongoThrottlerStorage implements ThrottlerStorage {
  constructor(
    @InjectModel(RateLimitRecord.name)
    private readonly records: Model<RateLimitRecordDocument>,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const record = await this.records
      .findOneAndUpdate(
        { key },
        [
          {
            $set: {
              windowActive: { $gt: ['$expiresAt', '$$NOW'] },
              blocked: { $gt: ['$blockExpiresAt', '$$NOW'] },
            },
          },
          {
            $set: {
              expiresAt: {
                $cond: [
                  '$windowActive',
                  '$expiresAt',
                  { $add: ['$$NOW', ttl] },
                ],
              },
              totalHits: {
                $cond: ['$windowActive', { $ifNull: ['$totalHits', 0] }, 0],
              },
            },
          },
          {
            $set: {
              totalHits: {
                $cond: [
                  '$blocked',
                  '$totalHits',
                  { $add: ['$totalHits', 1] },
                ],
              },
            },
          },
          {
            $set: {
              blockExpiresAt: {
                $cond: [
                  '$blocked',
                  '$blockExpiresAt',
                  {
                    $cond: [
                      { $gt: ['$totalHits', limit] },
                      { $add: ['$$NOW', blockDuration] },
                      null,
                    ],
                  },
                ],
              },
            },
          },
          {
            $set: {
              cleanupAt: { $max: ['$expiresAt', '$blockExpiresAt'] },
            },
          },
          { $unset: ['windowActive', 'blocked'] },
        ],
        { new: true, upsert: true },
      )
      .lean()
      .exec();

    const now = Date.now();
    const blockExpiresAt = record?.blockExpiresAt?.getTime() ?? 0;
    return {
      totalHits: record?.totalHits ?? 1,
      timeToExpire: Math.max(0, Math.ceil(((record?.expiresAt?.getTime() ?? now) - now) / 1000)),
      isBlocked: blockExpiresAt > now,
      timeToBlockExpire:
        blockExpiresAt > now ? Math.ceil((blockExpiresAt - now) / 1000) : 0,
    };
  }
}
