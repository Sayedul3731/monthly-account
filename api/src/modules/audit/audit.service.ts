import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { asPlainList } from '../../infrastructure/database/schema.helpers';
import { AuditEvent, type AuditEventDocument } from './audit-event.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditEvent.name)
    private readonly auditEventModel: Model<AuditEventDocument>,
  ) {}

  async record(input: {
    actorId: string;
    action: string;
    resource: string;
    statusCode: number;
  }): Promise<void> {
    await this.auditEventModel.create({
      actorId: new Types.ObjectId(input.actorId),
      action: input.action,
      resource: input.resource,
      statusCode: input.statusCode,
    });
  }

  async findRecent(limit = 100): Promise<AuditEvent[]> {
    const events = await this.auditEventModel
      .find()
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .exec();
    return asPlainList<AuditEvent>(events);
  }
}
