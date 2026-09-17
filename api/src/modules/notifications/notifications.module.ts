import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppRole, AppRoleSchema } from '../roles/app-role.schema';
import { User, UserSchema } from '../users/user.schema';
import { Notification, NotificationSchema } from './notification.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
      { name: AppRole.name, schema: AppRoleSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
