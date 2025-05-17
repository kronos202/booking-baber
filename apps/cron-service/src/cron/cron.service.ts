// apps/cron-service/src/cron/cron.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';
import dayjs from 'dayjs';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  // Nhắc nhở lịch hèn mỗi ngày lúc 8:00 sáng
  @Cron('0 8 * * *', { name: 'sendAppointmentReminders' })
  async sendAppointmentReminders() {
    this.logger.debug('Running sendAppointmentReminders cron job');

    try {
      const tomorrow = dayjs().add(1, 'day').startOf('day').toDate();
      const bookings = await this.prismaService.booking.findMany({
        where: {
          status: 'confirmed',
          startAt: {
            gte: dayjs().toDate(),
            lte: tomorrow,
          },
        },
        include: {
          customer: { select: { username: true, id: true } },
          service: true,
          branch: true,
        },
      });

      for (const booking of bookings) {
        const notification = {
          userId: booking.customer_id,
          message: `Nhắc nhở: Bạn có lịch hẹn ${booking.service.name} tại chi nhánh ${booking.branch.name} vào ${dayjs(booking.startAt).format('DD/MM/YYYY HH:mm')}.`,
          channels: ['email', 'sms'],
          senderId: 0,
          senderType: 'system',
        };
        await this.notificationClient
          .emit('send_notification', notification)
          .toPromise();
        this.logger.log(
          `Sent reminder for booking ${booking.id} to customer ${booking.customer_id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send appointment reminders: ${error.message}`,
      );
    }
  }

  // Làm sạch lịch hẹn bị hủy mỗi ngày lúc nửa đêm
  @Cron('0 0 * * *', { name: 'cleanCancelledBookings' })
  async cleanCancelledBookings() {
    this.logger.debug('Running cleanCancelledBookings cron job');

    try {
      const sevenDaysAgo = dayjs().subtract(7, 'day').toDate();
      const deletedBookings = await this.prismaService.booking.deleteMany({
        where: {
          status: 'cancelled',
          created_at: { lte: sevenDaysAgo },
        },
      });

      this.logger.log(`Deleted ${deletedBookings.count} cancelled bookings`);
    } catch (error) {
      this.logger.error(`Failed to clean cancelled bookings: ${error.message}`);
    }
  }

  // Cập nhật trạng thái hoàn tất mỗi giờ
  @Cron('0 * * * *', { name: 'updateCompletedBookings' })
  async updateCompletedBookings() {
    this.logger.debug('Running updateCompletedBookings cron job');

    try {
      const now = dayjs().toDate();
      const updatedBookings = await this.prismaService.booking.updateMany({
        where: {
          status: 'confirmed',
          startAt: { lte: now },
        },
        data: { status: 'completed' },
      });

      const completedBookings = await this.prismaService.booking.findMany({
        where: {
          status: 'completed',
          updated_at: { gte: dayjs().subtract(1, 'hour').toDate() },
        },
        include: { customer: { select: { id: true } } },
      });

      for (const booking of completedBookings) {
        const notification = {
          userId: booking.customer_id,
          message: `Lịch hẹn #${booking.id} đã hoàn tất. Vui lòng để lại đánh giá cho chúng tôi!`,
          channels: ['email'],
          senderId: 0,
          senderType: 'system',
        };
        await this.notificationClient
          .emit('send_notification', notification)
          .toPromise();
        this.logger.log(`Sent review reminder for booking ${booking.id}`);
      }

      this.logger.log(`Updated ${updatedBookings.count} bookings to completed`);
    } catch (error) {
      this.logger.error(
        `Failed to update completed bookings: ${error.message}`,
      );
    }
  }

  // Gửi báo cáo đánh giá theo chi nhánh mỗi thứ Hai lúc 9:00 sáng
  @Cron('0 9 * * 1', { name: 'sendBranchReviewReports' })
  async sendBranchReviewReports() {
    this.logger.debug('Running sendBranchReviewReports cron job');

    try {
      const branches = await this.prismaService.branch.findMany();
      const lastWeek = dayjs().subtract(7, 'day').toDate();

      for (const branch of branches) {
        const reviews = await this.prismaService.review.findMany({
          where: {
            branch_id: branch.id,
            created_at: { gte: lastWeek },
            is_visible: true,
          },
          include: { customer: { select: { username: true } }, service: true },
        });

        const averageRating =
          reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

        const notification = {
          userId: 0, // Admin
          message: `Báo cáo tuần cho chi nhánh ${branch.name}: ${reviews.length} đánh giá, trung bình ${averageRating.toFixed(1)} sao.`,
          channels: ['email'],
          senderId: 0,
          senderType: 'system',
        };
        await this.notificationClient
          .emit('send_notification', notification)
          .toPromise();
        this.logger.log(`Sent review report for branch ${branch.id}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send branch review reports: ${error.message}`,
      );
    }
  }
}
