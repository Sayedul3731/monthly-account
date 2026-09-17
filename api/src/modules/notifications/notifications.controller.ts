import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/jwt-payload.interface';
import { ParseObjectIdPipe } from '../../shared/pipes/parse-object-id.pipe';
import { Notification } from './notification.schema';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  @ApiOkResponse({ type: Notification, isArray: true })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findMine(user.userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: Notification })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  markRead(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markRead(id, user.userId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all current-user notifications as read' })
  @ApiNoContentResponse({ description: 'Notifications marked read' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.userId);
  }
}
