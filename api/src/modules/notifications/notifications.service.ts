import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  asPlain,
  asPlainList,
  notDeleted,
} from '../../infrastructure/database/schema.helpers';
import {
  AppRole,
  AppRoleDocument,
  DefaultRole,
} from '../roles/app-role.schema';
import { User, UserDocument } from '../users/user.schema';
import { Notification, NotificationDocument } from './notification.schema';
import { NotificationType } from './notification-type.enum';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(AppRole.name)
    private readonly roleModel: Model<AppRoleDocument>,
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

  async createForAdmins(
    input: Omit<Parameters<NotificationsService['create']>[0], 'userId'>,
  ): Promise<void> {
    const adminRole = await this.roleModel
      .findOne(notDeleted({ name: DefaultRole.ADMIN }))
      .exec();
    if (!adminRole) return;

    const admins = await this.userModel
      .find(notDeleted({ roleId: adminRole._id }))
      .select('_id')
      .exec();
    if (!admins.length) return;

    await this.notificationModel.insertMany(
      admins.map((admin) => ({
        userId: admin._id,
        type: input.type,
        title: input.title.trim(),
        message: input.message.trim(),
        link: input.link?.trim() || null,
      })),
    );
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
