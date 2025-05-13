import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { DatabaseService } from 'src/database/database.service';
import { AuthService } from '../auth/auth.service';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { google } from 'googleapis';

@Injectable()
export class BookingService {
  constructor(
    protected databaseService: DatabaseService,
    private authService: AuthService,
    private paymentService: PaymentService,
    private notificationService: NotificationService,
  ) {}

  async createBooking(dto: CreateBookingDto, userId: number) {
    const conflict = await this.databaseService.booking.findFirst({
      where: {
        branch_id: dto.branch_id,
        stylist_id: dto.stylist_id,
        startAt: new Date(dto.booking_time),
        status: { not: 'cancelled' },
      },
    });

    if (conflict) throw new BadRequestException('Slot already booked');

    const booking = await this.databaseService.booking.create({
      data: {
        branch_id: dto.branch_id,
        stylist_id: dto.stylist_id,
        service_id: dto.service_id,
        customer_id: userId,
        startAt: new Date(dto.booking_time),
        status: 'pending',
        total_price: dto.total_price,
      },
    });

    const credential = await this.databaseService.credential.findFirst({
      where: { user_id: userId, integration_type: 'GOOGLE' },
    });

    if (credential) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: credential.token });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const event = {
        summary: `Lịch hẹn: ${dto.service_name}`,
        location: dto.branch_name,
        description: `Khách: ${dto.customer_name}, Dịch vụ: ${dto.service_name}`,
        start: { dateTime: dto.booking_time, timeZone: 'Asia/Ho_Chi_Minh' },
        end: {
          dateTime: new Date(
            new Date(dto.booking_time).getTime() + dto.duration * 60000,
          ),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
      };

      try {
        const calendarEvent = await calendar.events.insert({
          calendarId: credential.data?.calendarId || 'primary',
          requestBody: event,
        });

        await this.databaseService.externalSession.create({
          data: {
            bookingId: booking.id,
            calendarType: 'google_calendar',
            externalSessionId: calendarEvent.data.id,
          },
        });
      } catch (error) {
        if (error.code === 401) {
          const newAccessToken =
            await this.authService.refreshGoogleAccessToken(userId);
          oauth2Client.setCredentials({ access_token: newAccessToken });
          const newCalendarEvent = await calendar.events.insert({
            calendarId: credential.data?.calendarId || 'primary',
            requestBody: event,
          });
          await this.databaseService.externalSession.create({
            data: {
              bookingId: booking.id,
              calendarType: 'google_calendar',
              externalSessionId: newCalendarEvent.data.id,
            },
          });
        } else throw error;
      }
    }

    const paymentResponse = await this.paymentService.createPaymentIntent(
      booking.id,
      dto.total_price,
      dto.branch_id,
      dto.payment_method,
    );

    await this.notificationService.sendNotification(
      userId,
      `Lịch hẹn của bạn đã được đặt: ${dto.service_name} tại ${dto.branch_name}, ${dto.booking_time}`,
    );

    return { booking, payment: paymentResponse };
  }

  async cancelBooking(bookingId: number, userId: number, userRole: string) {
    const booking = await this.databaseService.booking.findUnique({
      where: { id: bookingId },
      include: { branch: true },
    });
    if (!booking) throw new BadRequestException('Booking not found');
    if (userRole === 'customer' && booking.customer_id !== userId)
      throw new ForbiddenException('Only the customer can cancel this booking');

    const credential = await this.databaseService.credential.findFirst({
      where: { user_id: userId, integration_type: 'google_calendar' },
    });

    if (credential) {
      const externalSession =
        await this.databaseService.externalSession.findUnique({
          where: { bookingId: bookingId },
        });

      if (
        externalSession &&
        externalSession.calendarType === 'google_calendar'
      ) {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: credential.token });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        try {
          await calendar.events.delete({
            calendarId: credential.data?.calendarId || 'primary',
            eventId: externalSession.externalSessionId,
          });
        } catch (error) {
          if (error.code === 401) {
            const newAccessToken =
              await this.authService.refreshGoogleAccessToken(userId);
            oauth2Client.setCredentials({ access_token: newAccessToken });
            await calendar.events.delete({
              calendarId: credential.data?.calendarId || 'primary',
              eventId: externalSession.externalSessionId,
            });
          } else throw error;
        }

        await this.databaseService.externalSession.delete({
          where: { bookingId: bookingId },
        });
      }
    }

    const payment = await this.databaseService.payment.findUnique({
      where: { booking_id: bookingId },
    });
    if (payment) {
      if (
        payment.payment_method === 'stripe' &&
        payment.status === 'succeeded'
      ) {
        await this.paymentService.refundPayment(bookingId);
      } else if (
        payment.payment_method === 'vnpay' &&
        payment.status === 'succeeded'
      ) {
        await this.databaseService.payment.update({
          where: { booking_id: bookingId },
          data: { status: 'refunded', updated_at: new Date() },
        });
      } else {
        await this.databaseService.payment.update({
          where: { booking_id: bookingId },
          data: { status: 'cancelled', updated_at: new Date() },
        });
      }
    }

    await this.databaseService.booking.update({
      where: { id: bookingId },
      data: { status: 'cancelled' },
    });

    await this.notificationService.sendNotification(
      booking.customer_id,
      `Lịch hẹn của bạn tại ${booking.branch.name} đã được hủy.`,
    );

    return { message: 'Booking cancelled' };
  }

  async getAvailability(branchId: number, stylistId: number, date: string) {
    const bookings = await this.databaseService.booking.findMany({
      where: {
        branch_id: branchId,
        stylist_id: stylistId,
        booking_time: {
          gte: new Date(`${date}T00:00:00Z`),
          lte: new Date(`${date}T23:59:59Z`),
        },
        status: { not: 'cancelled' },
      },
    });

    const slots = [];
    const start = new Date(`${date}T08:00:00Z`);
    const end = new Date(`${date}T20:00:00Z`);

    while (start < end) {
      const isBooked = bookings.some(
        (b) => b.booking_time.getTime() === start.getTime(),
      );
      if (!isBooked) slots.push(start.toISOString());
      start.setMinutes(start.getMinutes() + 30);
    }

    return slots;
  }

  async getBranchBookings(branchId: number, userRole: string) {
    if (userRole !== 'admin' && userRole !== 'branch_manager')
      throw new ForbiddenException(
        'Only admins and branch managers can view branch bookings',
      );
    return this.databaseService.booking.findMany({
      where: { branch_id: branchId },
      include: { service: true, stylist: true, customer: true, payments: true },
    });
  }

  async getUserBookings(userId: number) {
    return this.databaseService.booking.findMany({
      where: { customer_id: userId },
      include: { service: true, stylist: true, payments: true },
    });
  }

  async updateBooking(id: number, dto: UpdateBookingDto, userRole: string) {
    if (userRole !== 'admin' && userRole !== 'branch_manager')
      throw new ForbiddenException(
        'Only admins and branch managers can update bookings',
      );
    const booking = await this.databaseService.booking.findUnique({
      where: { id },
      include: { branch: true, service: true },
    });
    if (!booking) throw new BadRequestException('Booking not found');
    if (dto.status === 'completed' && booking.status !== 'confirmed')
      throw new BadRequestException('Booking must be confirmed to complete');

    await this.databaseService.booking.update({
      where: { id },
      data: { status: dto.status },
    });

    if (dto.status === 'completed') {
      const payment = await this.databaseService.payment.findUnique({
        where: { booking_id: id },
      });
      if (payment && payment.payment_method === 'cash') {
        await this.databaseService.payment.update({
          where: { booking_id: id },
          data: { status: 'succeeded', updated_at: new Date() },
        });
      }
      await this.notificationService.sendNotification(
        booking.customer_id,
        `Lịch hẹn của bạn (${booking.service.name}) tại ${booking.branch.name} đã hoàn thành. Vui lòng để lại đánh giá!`,
      );
    }

    return { message: 'Booking updated' };
  }
}
