// booking/booking.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { AuthService } from '../auth/auth.service';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { CreateNotificationDto } from '../notification/dto/create-notification.dto';
import { google } from 'googleapis';
import { DatabaseService } from 'src/database/database.service';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { CredentialData } from 'src/types/credential-data';

// Enable Day.js plugins for UTC and timezone
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly TIMEZONE = 'Asia/Ho_Chi_Minh';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authService: AuthService,
    private readonly paymentService: PaymentService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateBookingDto, userId: number) {
    this.logger.log(
      `Creating booking for user ${userId}, branch ${dto.branch_id}`,
    );

    // Validate booking slot
    const bookingTime = dayjs(dto.booking_time).tz(this.TIMEZONE);
    const conflict = await this.databaseService.booking.findFirst({
      where: {
        branch_id: dto.branch_id,
        stylist_id: dto.stylist_id,
        startAt: bookingTime.toDate(),
        status: { not: 'cancelled' },
      },
    });

    if (conflict) {
      this.logger.warn(
        `Slot conflict detected for booking at ${bookingTime.format('YYYY-MM-DD HH:mm:ss')}`,
      );
      throw new BadRequestException('Slot already booked');
    }

    // Create booking
    const booking = await this.databaseService.booking.create({
      data: {
        branch_id: dto.branch_id,
        stylist_id: dto.stylist_id,
        service_id: dto.service_id,
        customer_id: userId,
        startAt: bookingTime.toDate(),
        status: 'pending',
        total_price: dto.total_price,
      },
    });

    // Sync with Google Calendar
    await this.syncGoogleCalendar(booking.id, userId, dto, 'create');

    // Create payment
    const paymentResponse = await this.paymentService.createPaymentIntent(
      booking.id,
      dto.total_price,
      dto.branch_id,
      dto.payment_method,
    );

    // Send notification
    const notificationDto: CreateNotificationDto = {
      userId,
      message: `Lịch hẹn của bạn đã được đặt: ${dto.service_name} tại ${dto.branch_name}, ${bookingTime.format('DD/MM/YYYY HH:mm')}`,
      channels: dto.notification_channels || ['email', 'sms', 'push'],
    };
    await this.notificationService.sendNotification(notificationDto);

    this.logger.log(`Booking created successfully: ${booking.id}`);
    return { booking, payment: paymentResponse };
  }

  async cancelBooking(bookingId: number, userId: number, userRole: string) {
    this.logger.log(`Cancelling booking ${bookingId} by user ${userId}`);

    const booking = await this.databaseService.booking.findUnique({
      where: { id: bookingId },
      include: { branch: true, service: true },
    });
    if (!booking) {
      this.logger.warn(`Booking ${bookingId} not found`);
      throw new BadRequestException('Booking not found');
    }
    if (userRole === 'customer' && booking.customer_id !== userId) {
      this.logger.warn(
        `User ${userId} not authorized to cancel booking ${bookingId}`,
      );
      throw new ForbiddenException('Only the customer can cancel this booking');
    }

    // Remove Google Calendar event
    await this.syncGoogleCalendar(bookingId, userId, null, 'delete');

    // Handle payment refund
    const payment = await this.databaseService.payment.findUnique({
      where: { booking_id: bookingId },
    });
    if (payment) {
      if (
        payment.payment_method === 'STRIPE' &&
        payment.status === 'SUCCEEDED'
      ) {
        await this.paymentService.refundPayment(bookingId);
      } else if (
        payment.payment_method === 'VN_PAY' &&
        payment.status === 'SUCCEEDED'
      ) {
        await this.databaseService.payment.update({
          where: { booking_id: bookingId },
          data: { status: 'REFUNDED', updated_at: dayjs().toDate() },
        });
      } else {
        await this.databaseService.payment.update({
          where: { booking_id: bookingId },
          data: { status: 'FAILED', updated_at: dayjs().toDate() },
        });
      }
    }

    // Update booking status
    await this.databaseService.booking.update({
      where: { id: bookingId },
      data: { status: 'cancelled' },
    });

    // Send notification
    const notificationDto: CreateNotificationDto = {
      userId: booking.customer_id!,
      message: `Lịch hẹn của bạn tại ${booking.branch.name} đã được hủy.`,
      channels: ['email', 'sms', 'push'],
    };
    await this.notificationService.sendNotification(notificationDto);

    this.logger.log(`Booking ${bookingId} cancelled successfully`);
    return { message: 'Booking cancelled' };
  }

  async getAvailability(branchId: number, stylistId: number, date: string) {
    this.logger.log(
      `Checking availability for branch ${branchId}, stylist ${stylistId}, date ${date}`,
    );

    if (!branchId || !stylistId || !date) {
      throw new BadRequestException('Missing required parameters');
    }

    const startOfDay = dayjs(date).tz(this.TIMEZONE).startOf('day');
    const endOfDay = startOfDay.endOf('day');

    const bookings = await this.databaseService.booking.findMany({
      where: {
        branch_id: branchId,
        stylist_id: stylistId,
        startAt: {
          gte: startOfDay.toDate(),
          lte: endOfDay.toDate(),
        },
        status: { not: 'cancelled' },
      },
      select: { startAt: true, service: { select: { duration: true } } },
    });

    // Explicitly define slots as string[] to avoid 'never' type issue
    const slots: string[] = [];
    let currentSlot = startOfDay.hour(8); // Start at 8:00 AM
    const endTime = startOfDay.hour(20); // End at 8:00 PM

    while (currentSlot.isBefore(endTime)) {
      const slotTime = currentSlot;
      const isBooked = bookings.some((b) => {
        const bookingStart = dayjs(b.startAt).tz(this.TIMEZONE);
        const bookingEnd = bookingStart.add(b.service.duration, 'minute');
        // Replace isSameOrAfter with isSame || isAfter
        return (
          (slotTime.isSame(bookingStart) || slotTime.isAfter(bookingStart)) &&
          slotTime.isBefore(bookingEnd)
        );
      });

      if (!isBooked) {
        slots.push(slotTime.toISOString());
      }
      currentSlot = currentSlot.add(30, 'minute');
    }

    this.logger.log(`Found ${slots.length} available slots`);
    return slots;
  }

  async getBranchBookings(branchId: number, userRole: string) {
    this.logger.log(`Fetching bookings for branch ${branchId}`);

    if (userRole !== 'admin' && userRole !== 'branch_manager') {
      this.logger.warn(
        `User role ${userRole} not authorized to view branch bookings`,
      );
      throw new ForbiddenException(
        'Only admins and branch managers can view branch bookings',
      );
    }

    const bookings = await this.databaseService.booking.findMany({
      where: { branch_id: branchId },
      include: { service: true, stylist: true, customer: true, payments: true },
    });

    this.logger.log(
      `Fetched ${bookings.length} bookings for branch ${branchId}`,
    );
    return bookings;
  }

  async getUserBookings(userId: number) {
    this.logger.log(`Fetching bookings for user ${userId}`);

    const bookings = await this.databaseService.booking.findMany({
      where: { customer_id: userId },
      include: { service: true, stylist: true, payments: true },
    });

    this.logger.log(`Fetched ${bookings.length} bookings for user ${userId}`);
    return bookings;
  }

  async findOne(id: number, userId: number, userRole: string) {
    this.logger.log(`Fetching booking ${id} for user ${userId}`);

    const booking = await this.databaseService.booking.findUnique({
      where: { id },
      include: { service: true, stylist: true, branch: true, payments: true },
    });

    if (!booking) {
      this.logger.warn(`Booking ${id} not found`);
      throw new BadRequestException('Booking not found');
    }

    if (
      booking.customer_id !== userId &&
      userRole !== 'admin' &&
      userRole !== 'branch_manager'
    ) {
      this.logger.warn(`User ${userId} not authorized to view booking ${id}`);
      throw new ForbiddenException(
        'You are not authorized to view this booking',
      );
    }

    return booking;
  }

  async update(
    id: number,
    dto: UpdateBookingDto,
    userId: number,
    userRole: string,
  ) {
    this.logger.log(`Updating booking ${id} by user ${userId}`);

    if (userRole !== 'admin' && userRole !== 'branch_manager') {
      this.logger.warn(
        `User role ${userRole} not authorized to update booking`,
      );
      throw new ForbiddenException(
        'Only admins and branch managers can update bookings',
      );
    }

    const booking = await this.databaseService.booking.findUnique({
      where: { id },
      include: { branch: true, service: true },
    });
    if (!booking) {
      this.logger.warn(`Booking ${id} not found`);
      throw new BadRequestException('Booking not found');
    }

    if (dto.status === 'completed' && booking.status !== 'confirmed') {
      this.logger.warn(`Booking ${id} must be confirmed to complete`);
      throw new BadRequestException('Booking must be confirmed to complete');
    }

    // Update Google Calendar if startAt changes
    if (dto.startAt) {
      await this.syncGoogleCalendar(
        id,
        booking.customer_id!,
        { booking_time: dto.startAt, duration: booking.service.duration },
        'update',
      );
    }

    await this.databaseService.booking.update({
      where: { id },
      data: {
        status: dto.status,
        startAt: dto.startAt
          ? dayjs(dto.startAt).tz(this.TIMEZONE).toDate()
          : undefined,
      },
    });

    if (dto.status === 'completed') {
      const payment = await this.databaseService.payment.findUnique({
        where: { booking_id: id },
      });
      if (payment && payment.payment_method === 'CASH') {
        await this.databaseService.payment.update({
          where: { booking_id: id },
          data: { status: 'SUCCEEDED', updated_at: dayjs().toDate() },
        });
      }
      const notificationDto: CreateNotificationDto = {
        userId: booking.customer_id!,
        message: `Lịch hẹn của bạn (${booking.service.name}) tại ${booking.branch.name} đã hoàn thành. Vui lòng để lại đánh giá!`,
        channels: ['email', 'sms', 'push'],
      };
      await this.notificationService.sendNotification(notificationDto);
    }

    this.logger.log(`Booking ${id} updated successfully`);
    return { message: 'Booking updated' };
  }

  // apps/booking-service/src/booking/booking.service.ts
  async filterBookings(
    userId: number,
    userRole: string,
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    this.logger.log(
      `Filtering bookings for user ${userId}, role ${userRole}, branch ${branchId || 'all'}`,
    );

    // Validate inputs
    if (branchId && userRole !== 'admin' && userRole !== 'branch_manager') {
      this.logger.warn(
        `User role ${userRole} not authorized to filter by branch`,
      );
      throw new ForbiddenException(
        'Only admins and branch managers can filter by branch',
      );
    }

    if (!from || !to) {
      throw new BadRequestException('Missing from or to date');
    }

    const startDate = dayjs(from).tz(this.TIMEZONE).startOf('day').toDate();
    const endDate = dayjs(to).tz(this.TIMEZONE).endOf('day').toDate();

    if (dayjs(endDate).isBefore(startDate)) {
      throw new BadRequestException('End date must be after start date');
    }

    try {
      const where: any = {
        startAt: { gte: startDate, lte: endDate },
      };

      if (branchId) {
        where.branch_id = branchId;
      } else if (userRole === 'customer') {
        where.customer_id = userId;
      }

      const bookings = await this.databaseService.booking.findMany({
        where,
        include: {
          branch: true,
          stylist: true,
          service: true,
          customer: { select: { username: true } },
          payments: true,
        },
        orderBy: { startAt: 'asc' },
      });

      this.logger.log(`Found ${bookings.length} bookings`);
      return bookings;
    } catch (error) {
      this.logger.error(`Failed to filter bookings: ${error.message}`);
      throw new BadRequestException('Failed to filter bookings');
    }
  }

  // apps/booking-service/src/booking/booking.service.ts
  async confirmCashPayment(
    bookingId: number,
    userId: number,
    userRole: string,
  ) {
    this.logger.log(
      `Confirming cash payment for booking ${bookingId} by user ${userId}`,
    );

    if (userRole !== 'admin' && userRole !== 'branch_manager') {
      this.logger.warn(
        `User role ${userRole} not authorized to confirm cash payment`,
      );
      throw new ForbiddenException(
        'Only admins and branch managers can confirm cash payments',
      );
    }

    const booking = await this.databaseService.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true },
    });
    if (!booking) {
      throw new BadRequestException('Booking not found');
    }

    const payment = booking.payments.find((p) => p.booking_id === bookingId);
    if (!payment || payment.payment_method !== 'CASH') {
      throw new BadRequestException('No cash payment found for this booking');
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Payment is not in pending state');
    }

    try {
      await this.databaseService.payment.update({
        where: { booking_id: bookingId },
        data: { status: 'SUCCEEDED', updated_at: dayjs().toDate() },
      });

      await this.databaseService.booking.update({
        where: { id: bookingId },
        data: { status: 'confirmed', updated_at: dayjs().toDate() },
      });

      const notificationDto: CreateNotificationDto = {
        userId: booking.customer_id!,
        message: `Thanh toán tiền mặt cho lịch hẹn #${bookingId} đã được xác nhận.`,
        channels: ['email', 'sms'],
      };
      await this.notificationService.sendNotification(notificationDto);

      this.logger.log(`Cash payment confirmed for booking ${bookingId}`);
      return { message: 'Cash payment confirmed' };
    } catch (error) {
      this.logger.error(`Failed to confirm cash payment: ${error.message}`);
      throw new BadRequestException('Failed to confirm cash payment');
    }
  }

  private async syncGoogleCalendar(
    bookingId: number,
    userId: number,
    dto: Partial<CreateBookingDto> | null,
    action: 'create' | 'update' | 'delete',
  ) {
    this.logger.log(
      `Đồng bộ Google Calendar cho booking ${bookingId}, hành động: ${action}`,
    );

    const credential = await this.databaseService.credential.findFirst({
      where: { user_id: userId, integration_type: 'GOOGLE' },
    });

    if (!credential) {
      this.logger.debug(
        `Không tìm thấy thông tin Google Calendar cho người dùng ${userId}`,
      );
      return;
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: credential.token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      if (action === 'create' && dto) {
        const bookingTime = dayjs(dto.booking_time).tz(this.TIMEZONE);
        const event = {
          summary: `Lịch hẹn: ${dto.service_name}`,
          location: dto.branch_name,
          description: `Khách: ${dto.customer_name}, Dịch vụ: ${dto.service_name}`,
          start: {
            dateTime: bookingTime.toISOString(),
            timeZone: this.TIMEZONE,
          },
          end: {
            dateTime: bookingTime.add(dto.duration!, 'minute').toISOString(),
            timeZone: this.TIMEZONE,
          },
        };

        // Ép kiểu credential.data thành CredentialData
        const data = credential.data as CredentialData | null;
        const calendarEvent = await calendar.events.insert({
          calendarId: data?.calendarId || 'primary',
          requestBody: event,
        });

        await this.databaseService.externalSession.create({
          data: {
            bookingId,
            calendarType: 'GOOGLE_CALENDAR',
            externalSessionId: calendarEvent.data.id!,
          },
        });
      } else if (action === 'update' && dto) {
        const externalSession =
          await this.databaseService.externalSession.findUnique({
            where: { bookingId },
          });

        if (
          externalSession &&
          externalSession.calendarType === 'GOOGLE_CALENDAR'
        ) {
          const bookingTime = dayjs(dto.booking_time).tz(this.TIMEZONE);
          const data = credential.data as CredentialData | null;
          await calendar.events.patch({
            calendarId: data?.calendarId || 'primary',
            eventId: externalSession.externalSessionId,
            requestBody: {
              start: {
                dateTime: bookingTime.toISOString(),
                timeZone: this.TIMEZONE,
              },
              end: {
                dateTime: bookingTime
                  .add(dto.duration || 30, 'minute')
                  .toISOString(),
                timeZone: this.TIMEZONE,
              },
            },
          });
        }
      } else if (action === 'delete') {
        const externalSession =
          await this.databaseService.externalSession.findUnique({
            where: { bookingId },
          });

        if (
          externalSession &&
          externalSession.calendarType === 'GOOGLE_CALENDAR'
        ) {
          const data = credential.data as CredentialData | null;
          await calendar.events.delete({
            calendarId: data?.calendarId || 'primary',
            eventId: externalSession.externalSessionId,
          });
          await this.databaseService.externalSession.delete({
            where: { bookingId },
          });
        }
      }
    } catch (error) {
      if (error.code === 401) {
        this.logger.warn(
          `Token Google Calendar hết hạn cho người dùng ${userId}`,
        );
        const newAccessToken =
          await this.authService.refreshGoogleAccessToken(userId);
        oauth2Client.setCredentials({ access_token: newAccessToken });
        // Thử lại thao tác
        await this.syncGoogleCalendar(bookingId, userId, dto, action);
      } else {
        this.logger.error(`Đồng bộ Google Calendar thất bại: ${error.message}`);
        throw error;
      }
    }
  }
}
