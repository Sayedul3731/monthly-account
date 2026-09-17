import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  asPlain,
  asPlainList,
  notDeleted,
} from '../../infrastructure/database/schema.helpers';
import { Notification, NotificationDocument } from './notification.schema';
import { NotificationType } from './notification-type.enum';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string | null;
  }): Promise<Notification> {
    const notification = await this.notificationModel.create({
      userId: new Types.ObjectId(input.userId),
      type: input.type,
      title: input.title.trim(),
      message: input.message.trim(),
      link: input.link?.trim() || null,
    });
    return asPlain<Notification>(notification);
  }

  async findMine(userId: string): Promise<Notification[]> {
    const notifications = await this.notificationModel
      .find(notDeleted({ userId: new Types.ObjectId(userId) }))
      .sort({ createdAt: -1 })
      .exec();
    return asPlainList<Notification>(notifications);
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationModel
      .findOneAndUpdate(
        notDeleted({ _id: id, userId: new Types.ObjectId(userId) }),
        { readAt: new Date() },
        { new: true },
      )
      .exec();
    if (!notification)
      throw new NotFoundException(`Notification ${id} not found`);
    return asPlain<Notification>(notification);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationModel
      .updateMany(
        notDeleted({ userId: new Types.ObjectId(userId), readAt: null }),
        { readAt: new Date() },
      )
      .exec();
  }
}
