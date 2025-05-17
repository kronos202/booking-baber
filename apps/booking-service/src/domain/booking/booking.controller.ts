// apps/booking-service/src/booking/booking.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Logger,
  Query,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@ApiTags('booking')
@Controller('booking')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(private readonly bookingService: BookingService) {}

  @Post('create')
  @ApiOperation({ summary: 'Tạo lịch hẹn mới' })
  @ApiResponse({ status: 200, description: 'Lịch hẹn được tạo thành công' })
  @ApiBody({
    description: 'Thông tin lịch hẹn',
    schema: {
      type: 'object',
      properties: {
        branch_id: { type: 'number', example: 1 },
        stylist_id: { type: 'number', example: 1 },
        service_id: { type: 'number', example: 1 },
        booking_time: {
          type: 'string',
          format: 'date-time',
          example: '2025-05-18T10:00:00Z',
        },
        total_price: { type: 'number', example: 10 },
        payment_method: { type: 'string', example: 'VNPAY' },
        service_name: { type: 'string', example: 'Cắt tóc' },
        branch_name: { type: 'string', example: 'Hà Nội' },
        customer_name: { type: 'string', example: 'Nguyễn Văn A' },
        duration: { type: 'number', example: 30 },
        notification_channels: {
          type: 'array',
          items: { type: 'string' },
          example: ['email', 'sms'],
        },
      },
      required: [
        'branch_id',
        'stylist_id',
        'service_id',
        'booking_time',
        'total_price',
        'payment_method',
      ],
    },
  })
  async createBooking(@Body() dto: CreateBookingDto, @Request() req: any) {
    this.logger.debug(`Creating booking for customer ${req.user.id}`);
    return this.bookingService.create(dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hủy lịch hẹn' })
  @ApiResponse({ status: 200, description: 'Lịch hẹn đã bị hủy' })
  @ApiQuery({
    name: 'id',
    required: true,
    description: 'ID lịch hẹn',
    type: Number,
  })
  async cancelBooking(
    @Query('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    this.logger.debug(`Cancelling booking ${id} by user ${req.user.id}`);
    return this.bookingService.cancelBooking(id, req.user.id, req.user.role);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Kiểm tra khung giờ trống' })
  @ApiResponse({ status: 200, description: 'Danh sách khung giờ trống' })
  @ApiQuery({
    name: 'branchId',
    required: true,
    description: 'ID chi nhánh',
    type: Number,
  })
  @ApiQuery({
    name: 'stylistId',
    required: true,
    description: 'ID thợ cắt tóc',
    type: Number,
  })
  @ApiQuery({
    name: 'date',
    required: true,
    description: 'Ngày cần kiểm tra (YYYY-MM-DD)',
    type: String,
  })
  async getAvailability(
    @Query('branchId', ParseIntPipe) branchId: number,
    @Query('stylistId', ParseIntPipe) stylistId: number,
    @Query('date') date: string,
  ) {
    this.logger.debug(
      `Checking availability for branch ${branchId}, stylist ${stylistId}, date ${date}`,
    );
    return this.bookingService.getAvailability(branchId, stylistId, date);
  }

  @Get('branch')
  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn theo chi nhánh' })
  @ApiResponse({ status: 200, description: 'Danh sách lịch hẹn' })
  @ApiQuery({
    name: 'branchId',
    required: true,
    description: 'ID chi nhánh',
    type: Number,
  })
  async getBranchBookings(
    @Query('branchId', ParseIntPipe) branchId: number,
    @Request() req: any,
  ) {
    this.logger.debug(`Fetching bookings for branch ${branchId}`);
    return this.bookingService.getBranchBookings(branchId, req.user.role);
  }

  @Get('user')
  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn của khách hàng' })
  @ApiResponse({ status: 200, description: 'Danh sách lịch hẹn' })
  async getUserBookings(@Request() req: any) {
    this.logger.debug(`Fetching bookings for user ${req.user.id}`);
    return this.bookingService.getUserBookings(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết lịch hẹn' })
  @ApiResponse({ status: 200, description: 'Thông tin lịch hẹn' })
  @ApiQuery({
    name: 'id',
    required: true,
    description: 'ID lịch hẹn',
    type: Number,
  })
  async findOne(@Query('id', ParseIntPipe) id: number, @Request() req: any) {
    this.logger.debug(`Fetching booking ${id} for user ${req.user.id}`);
    return this.bookingService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật lịch hẹn' })
  @ApiResponse({ status: 200, description: 'Lịch hẹn được cập nhật' })
  @ApiQuery({
    name: 'id',
    required: true,
    description: 'ID lịch hẹn',
    type: Number,
  })
  @ApiBody({
    description: 'Thông tin cập nhật',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'confirmed' },
        startAt: {
          type: 'string',
          format: 'date-time',
          example: '2025-05-18T11:00:00Z',
        },
      },
    },
  })
  async updateBooking(
    @Query('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBookingDto,
    @Request() req: any,
  ) {
    this.logger.debug(`Updating booking ${id} by user ${req.user.id}`);
    return this.bookingService.update(id, dto, req.user.id, req.user.role);
  }

  @Get('filter')
  @ApiOperation({ summary: 'Lọc lịch hẹn theo ngày/tháng' })
  @ApiResponse({ status: 200, description: 'Danh sách lịch hẹn' })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'ID chi nhánh',
    type: Number,
  })
  @ApiQuery({
    name: 'from',
    required: true,
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'to',
    required: true,
    description: 'Ngày kết thúc (YYYY-MM-DD)',
    type: String,
  })
  async filterBookings(
    @Query('branchId') branchId: number | undefined,
    @Query('from') from: string,
    @Query('to') to: string,
    @Request() req: any,
  ) {
    this.logger.debug(`Filtering bookings for user ${req.user.id}`);
    return this.bookingService.filterBookings(
      req.user.id,
      req.user.role,
      branchId ? parseInt(branchId.toString()) : undefined,
      from,
      to,
    );
  }

  @Post(':id/confirm-cash-payment')
  @ApiOperation({ summary: 'Xác nhận thanh toán tiền mặt' })
  @ApiResponse({
    status: 200,
    description: 'Thanh toán tiền mặt được xác nhận',
  })
  @ApiQuery({
    name: 'id',
    required: true,
    description: 'ID lịch hẹn',
    type: Number,
  })
  async confirmCashPayment(
    @Query('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    this.logger.debug(`Confirming cash payment for booking ${id}`);
    return this.bookingService.confirmCashPayment(
      id,
      req.user.id,
      req.user.role,
    );
  }
}
