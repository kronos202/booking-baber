// notification/notification.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as sendgrid from '@sendgrid/mail';
import { Twilio } from 'twilio';
import { ConfigService } from '@nestjs/config';
import { retry } from 'ts-retry-promise';
import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin/lib/app';
import { DatabaseService } from 'src/database/database.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetNotificationsDto } from './dto/get-notifications.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly twilioClient: Twilio;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    sendgrid.setApiKey(this.configService.get('SENDGRID_API_KEY')!);
    this.twilioClient = new Twilio(
      this.configService.get('TWILIO_ACCOUNT_SID'),
      this.configService.get('TWILIO_AUTH_TOKEN'),
    );

    // Initialize Firebase Admin SDK for push notifications
    const firebaseCredentials = this.configService.get<ServiceAccount | string>(
      'FIREBASE_CREDENTIALS',
    );
    if (!firebaseCredentials) {
      this.logger.error('Thiếu cấu hình FIREBASE_CREDENTIALS');
      throw new BadRequestException('Thiếu cấu hình FIREBASE_CREDENTIALS');
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        // https://www.youtube.com/watch?v=ug6PvKGKuLk&list=PLgYFT7gUQL8FDmRWkVqLaLJmdsvgPsa8H&index=7
        credential: admin.credential.cert(firebaseCredentials),
      });
    }
  }

  async sendNotification(dto: CreateNotificationDto) {
    const { userId, message, channels = ['email', 'sms', 'push'] } = dto;
    this.logger.log(`Sending notification to user ${userId}`);

    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      this.logger.warn(`User ${userId} not found`);
      throw new BadRequestException('User not found');
    }

    // Save notification to database
    const notification = await this.databaseService.notification.create({
      data: {
        user_id: userId,
        message,
        status: 'UNREAD',
        channels: channels.join(','),
      },
    });

    const promises: Promise<void>[] = [];

    // Email notification
    if (channels.includes('email') && user.email) {
      const emailPromise = retry(
        () =>
          sendgrid.send({
            to: user.email,
            from: {
              email: this.configService.get('FROM_EMAIL')!,
              name: this.configService.get('FROM_NAME'),
            },
            subject: 'Thông báo từ BarberShop',
            html: this.getEmailTemplate(message),
          }),
        { retries: 3, delay: 1000 },
      )
        .then(() => {
          // Bỏ qua MessageInstance, trả về void
        })
        .catch((error) => {
          this.logger.error(
            `Email failed for user ${userId}: ${error.message}`,
          );
          this.updateNotificationStatus(notification.id, 'FAILED_EMAIL');
        });
      promises.push(emailPromise);
    }

    // SMS notification
    if (channels.includes('sms') && user.phone) {
      const smsPromise = retry(
        () =>
          this.twilioClient.messages.create({
            body: message,
            from: this.configService.get('TWILIO_PHONE_NUMBER'),
            to: user.phone.startsWith('+')
              ? user.phone
              : `+84${user.phone.slice(1)}`,
          }),
        { retries: 3, delay: 1000 },
      )
        .then(() => {
          // Bỏ qua MessageInstance, trả về void
        })
        .catch((error) => {
          this.logger.error(`SMS failed for user ${userId}: ${error.message}`);
          this.updateNotificationStatus(notification.id, 'FAILED_SMS');
        });
      promises.push(smsPromise);
    }

    // Push notification
    if (channels.includes('push') && user.fcmToken) {
      const pushPromise = retry(
        () =>
          admin.messaging().send({
            token: user.fcmToken!,
            notification: {
              title: 'BarberShop Notification',
              body: message,
            },
            data: { notificationId: notification.id.toString() },
          }),
        { retries: 3, delay: 1000 },
      )
        .then(() => {
          // Bỏ qua MessageInstance, trả về void
        })
        .catch((error) => {
          this.logger.error(
            `Push notification failed for user ${userId}: ${error.message}`,
          );
          this.updateNotificationStatus(notification.id, 'FAILED_PUSH');
        });
      promises.push(pushPromise);
    }

    await Promise.all(promises);
    this.logger.log(`Notification sent successfully to user ${userId}`);
    return {
      message: 'Notification sent successfully',
      notificationId: notification.id,
    };
  }

  async getUserNotifications(userId: number, options: GetNotificationsDto) {
    this.logger.log(`Fetching notifications for user ${userId}`);

    const { page = 1, limit = 10, status } = options;
    const skip = (page - 1) * limit;

    const where = {
      user_id: userId,
      ...(status !== 'ALL' ? { status } : {}),
    };

    const [notifications, total] = await Promise.all([
      this.databaseService.notification.findMany({
        where: where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.notification.count({ where }),
    ]);

    this.logger.log(
      `Fetched ${notifications.length} notifications for user ${userId}`,
    );
    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: number, userId: number) {
    this.logger.log(
      `Marking notification ${notificationId} as read for user ${userId}`,
    );

    const notification = await this.databaseService.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.user_id !== userId) {
      this.logger.warn(
        `Notification ${notificationId} not found or unauthorized for user ${userId}`,
      );
      throw new BadRequestException('Notification not found or unauthorized');
    }

    const updatedNotification = await this.databaseService.notification.update({
      where: { id: notificationId },
      data: { status: 'READ' },
    });

    this.logger.log(`Notification ${notificationId} marked as read`);
    return updatedNotification;
  }

  async deleteNotification(notificationId: number, userId: number) {
    this.logger.log(
      `Deleting notification ${notificationId} for user ${userId}`,
    );

    const notification = await this.databaseService.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.user_id !== userId) {
      this.logger.warn(
        `Notification ${notificationId} not found or unauthorized for user ${userId}`,
      );
      throw new BadRequestException('Notification not found or unauthorized');
    }

    await this.databaseService.notification.delete({
      where: { id: notificationId },
    });

    this.logger.log(`Notification ${notificationId} deleted`);
    return { message: 'Notification deleted successfully' };
  }

  private async updateNotificationStatus(
    notificationId: number,
    status: string,
  ) {
    await this.databaseService.notification.update({
      where: { id: notificationId },
      data: { delivery_status: status },
    });
  }

  private getEmailTemplate(message: string): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>BarberShop Notification</h2>
          <p>${message}</p>
          <p>Thank you for choosing our services!</p>
          <footer style="margin-top: 20px; color: #888;">
            <p>BarberShop Team</p>
          </footer>
        </body>
      </html>
    `;
  }
}
