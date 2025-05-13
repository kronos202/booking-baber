import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
  private logger = new Logger(NotificationController.name);

  constructor(private notificationService: NotificationService) {}

  @Post('create')
  async createNotification(
    @Body('userId', ParseIntPipe) userId: number,
    @Body('message') message: string,
  ) {
    this.logger.debug(`Tạo thông báo cho userId=${userId}`);
    return await this.notificationService.sendNotification(userId, message);
  }

  @Get('user/:userId')
  async getUserNotifications(@Param('userId', ParseIntPipe) userId: number) {
    this.logger.debug(`Lấy thông báo cho userId=${userId}`);
    return this.notificationService.getUserNotifications(userId);
  }

  @Post('read/:id')
  async markAsRead(
    @Param('id', ParseIntPipe) notificationId: number,
    @Body('userId', ParseIntPipe) userId: number,
  ) {
    this.logger.debug(`Đánh dấu thông báo đã đọc: ${notificationId}`);
    return this.notificationService.markAsRead(notificationId, userId);
  }
}
