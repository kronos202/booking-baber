import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as sendgrid from '@sendgrid/mail';
import { DatabaseService } from 'src/database/database.service';
import { Twilio } from 'twilio';

@Injectable()
export class NotificationService {
  private twilioClient: Twilio;
  private logger = new Logger(NotificationService.name);
  constructor(protected databaseService: DatabaseService) {
    sendgrid.setApiKey(process.env.SENDGRID_API_KEY!);
    this.twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  async sendNotification(userId: number, message: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new BadRequestException('User not found');

    // Lưu thông báo vào database
    await this.databaseService.notification.create({
      data: {
        user_id: userId,
        message,
        status: 'UNREAD',
      },
    });

    const emailPromise = user.email
      ? sendgrid
          .send({
            to: user.email,
            from: {
              email: process.env.FROM_EMAIL!,
              name: process.env.FROM_NAME,
            },
            subject: 'Thông báo từ BarberShop',
            text: message,
          })
          .catch((error) => {
            console.error('Email failed:', error);
          })
      : Promise.resolve();

    const smsPromise = this.twilioClient.messages
      .create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: user.phone.startsWith('+')
          ? user.phone
          : `+84${user.phone.slice(1)}`,
      })
      .catch((error) => {
        console.error('SMS failed:', error);
      });

    await Promise.all([emailPromise, smsPromise]);
    this.logger.log(`Tạo thông báo thành công cho người dùng ${userId}`);
    return { message: 'Notification sent successfully' };
  }

  async getUserNotifications(userId: number) {
    return await this.databaseService.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async markAsRead(notificationId: number, userId: number) {
    const notification = await this.databaseService.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.user_id !== userId)
      throw new BadRequestException('Notification not found or unauthorized');
    return this.databaseService.notification.update({
      where: { id: notificationId },
      data: { status: 'READ' },
    });
  }
}
