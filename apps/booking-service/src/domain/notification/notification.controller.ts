import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Request,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ParseIntPipe } from '@nestjs/common';

@ApiTags('notification')
@Controller('notification')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'branch_manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo thông báo mới cho người dùng' })
  @ApiResponse({ status: 201, description: 'Thông báo được tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền tạo thông báo' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    this.logger.log(
      `Tạo thông báo cho userId=${createNotificationDto.userId}, message="${createNotificationDto.message}", channels=${createNotificationDto.channels?.join(
        ',',
      )}`,
    );
    return this.notificationService.sendNotification(createNotificationDto);
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy danh sách thông báo của người dùng với phân trang và lọc',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách thông báo được lấy thành công',
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Số trang (mặc định 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Số lượng mỗi trang (mặc định 10)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['UNREAD', 'READ', 'ALL'],
    description: 'Trạng thái thông báo (mặc định ALL)',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getUserNotifications(
    @Request() req,
    @Query() query: GetNotificationsDto,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `Lấy danh sách thông báo cho userId=${userId}, page=${query.page}, limit=${query.limit}, status=${query.status}`,
    );
    return this.notificationService.getUserNotifications(userId, query);
  }

  @Post('read/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu thông báo là đã đọc' })
  @ApiResponse({
    status: 200,
    description: 'Thông báo được đánh dấu là đã đọc',
  })
  @ApiResponse({
    status: 400,
    description: 'Thông báo không tìm thấy hoặc không được phép',
  })
  async markAsRead(
    @Param('id', ParseIntPipe) notificationId: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `Đánh dấu thông báo ${notificationId} là đã đọc cho userId=${userId}`,
    );
    return this.notificationService.markAsRead(notificationId, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa thông báo' })
  @ApiResponse({ status: 200, description: 'Thông báo đã được xóa thành công' })
  @ApiResponse({
    status: 400,
    description: 'Thông báo không tìm thấy hoặc không được phép',
  })
  async deleteNotification(
    @Param('id', ParseIntPipe) notificationId: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    this.logger.log(`Xóa thông báo ${notificationId} cho userId=${userId}`);
    return this.notificationService.deleteNotification(notificationId, userId);
  }
}
