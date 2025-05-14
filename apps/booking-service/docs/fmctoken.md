model User {
  id              Int           @id @default(autoincrement())
  email           String        @unique
  phone           String        @unique
  name            String
  password        String
  role            String        @default("customer")
  created_at      DateTime      @default(now())
  updated_at      DateTime      @updatedAt
  bookings        Booking[]     @relation("CustomerBookings")
  notifications   Notification[]
  credentials     Credential[]
  fcmTokens       FcmToken[]    // Quan hệ với bảng FcmToken
}

model FcmToken {
  id              Int           @id @default(autoincrement())
  user_id         Int
  token           String        @unique // FCM Token
  platform        String?       // Ví dụ: 'mobile', 'web'
  device_id       String?       // ID thiết bị (tùy chọn)
  created_at      DateTime      @default(now())
  updated_at      DateTime      @updatedAt
  user            User          @relation(fields: [user_id], references: [id])
}

async updateFcmToken(userId: number, fcmToken: string, platform: string, deviceId?: string) {
    this.logger.log(`Cập nhật FCM Token cho người dùng ${userId}`);

    // Thêm hoặc cập nhật token trong bảng FcmToken
    await this.databaseService.fcmToken.upsert({
      where: { token: fcmToken },
      update: {
        user_id: userId,
        platform,
        device_id: deviceId,
        updated_at: new Date(),
      },
      create: {
        user_id: userId,
        token: fcmToken,
        platform,
        device_id: deviceId,
      },
    });

    return { message: 'FCM Token đã được cập nhật' };
  }

  @Post('update-fcm-token')
  @UseGuards(JwtAuthGuard)
  async updateFcmToken(
    @Body('userId') userId: number,
    @Body('fcmToken') fcmToken: string,
    @Body('platform') platform: string,
    @Body('deviceId') deviceId?: string,
  ) {
    return this.userService.updateFcmToken(userId, fcmToken, platform, deviceId);
  }

  // user/dto/update-fcm-token.dto.ts
import { IsInt, IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateFcmTokenDto {
  @IsInt()
  userId: number;

  @IsString()
  fcmToken: string;

  @IsEnum(['mobile', 'web'])
  platform: string;

  @IsString()
  @IsOptional()
  deviceId?: string;
}

async sendNotification(dto: CreateNotificationDto) {
  const { userId, message, channels = ['email', 'sms', 'push'] } = dto;
  this.logger.log(`Gửi thông báo đến người dùng ${userId}`);

  const user = await this.databaseService.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    this.logger.warn(`Người dùng ${userId} không tìm thấy`);
    throw new BadRequestException('Người dùng không tìm thấy');
  }

  // Lưu thông báo vào database
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
    ).catch((error) => {
      this.logger.error(`Email failed for user ${userId}: ${error.message}`);
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
          to: user.phone.startsWith('+') ? user.phone : `+84${user.phone.slice(1)}`,
        }),
      { retries: 3, delay: 1000 },
    )
      .then(() => {
        // Bỏ qua MessageInstance
      })
      .catch((error) => {
        this.logger.error(`SMS failed for user ${userId}: ${error.message}`);
        this.updateNotificationStatus(notification.id, 'FAILED_SMS');
      });
    promises.push(smsPromise);
  }

  // Push notification
  if (channels.includes('push') && admin.apps.length) {
    // Lấy tất cả fcmToken của người dùng
    const fcmTokens = await this.databaseService.fcmToken.findMany({
      where: { user_id: userId },
      select: { token: true },
    });

    for (const { token } of fcmTokens) {
      const pushPromise = retry(
        () =>
          admin.messaging().send({
            token,
            notification: {
              title: 'BarberShop Notification',
              body: message,
            },
            data: { notificationId: notification.id.toString() },
          }),
        { retries: 3, delay: 1000 },
      ).catch((error) => {
        this.logger.error(`Push notification failed for user ${userId}, token ${token}: ${error.message}`);
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
          // Xóa token không hợp lệ
          this.databaseService.fcmToken.delete({ where: { token } });
        }
        this.updateNotificationStatus(notification.id, 'FAILED_PUSH');
      });
      promises.push(pushPromise);
    }
  }

  await Promise.all(promises);
  this.logger.log(`Thông báo gửi thành công đến người dùng ${userId}`);
  return { message: 'Thông báo gửi thành công', notificationId: notification.id };
}

if (
  error.code === 'messaging/invalid-registration-token' ||
  error.code === 'messaging/registration-token-not-registered'
) {
  this.databaseService.fcmToken.delete({ where: { token } });
}

async updateFcmToken(userId: number, fcmToken: string, platform: string, deviceId?: string) {
  // Kiểm tra số lượng token
  const tokenCount = await this.databaseService.fcmToken.count({
    where: { user_id: userId },
  });
  if (tokenCount >= 5) {
    // Xóa token cũ nhất
    const oldestToken = await this.databaseService.fcmToken.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' },
    });
    if (oldestToken) {
      await this.databaseService.fcmToken.delete({
        where: { id: oldestToken.id },
      });
    }
  }

  // Thêm hoặc cập nhật token
  await this.databaseService.fcmToken.upsert({
    where: { token: fcmToken },
    update: {
      user_id: userId,
      platform,
      device_id: deviceId,
      updated_at: new Date(),
    },
    create: {
      user_id: userId,
      token: fcmToken,
      platform,
      device_id: deviceId,
    },
  });

  return { message: 'FCM Token đã được cập nhật' };
}

async getFcmTokens(userId: number): Promise<string[]> {
  const cacheKey = `fcmTokens:${userId}`;
  const cachedTokens = await redis.get(cacheKey);
  if (cachedTokens) {
    return JSON.parse(cachedTokens);
  }

  const fcmTokens = await this.databaseService.fcmToken.findMany({
    where: { user_id: userId },
    select: { token: true },
  });
  const tokens = fcmTokens.map(({ token }) => token);

  await redis.set(cacheKey, JSON.stringify(tokens), 'EX', 3600); // Cache 1 giờ
  return tokens;
}

async updateFcmToken(userId: number, fcmToken: string, platform: string, deviceId?: string) {
  await this.databaseService.fcmToken.upsert({...});
  await admin.messaging().subscribeToTopic(fcmToken, `user_${userId}`);
}

admin.messaging().sendToTopic(`user_${userId}`, {
  notification: {
    title: 'BarberShop Notification',
    body: message,
  },
  data: { notificationId: notification.id.toString() },
});

----

// user/user.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@app/database';
import * as admin from 'firebase-admin';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async updateFcmToken(userId: number, fcmToken: string, platform: string, deviceId?: string) {
    this.logger.log(`Cập nhật FCM Token cho người dùng ${userId}`);

    // Thêm hoặc cập nhật token trong bảng FcmToken
    await this.databaseService.fcmToken.upsert({
      where: { token: fcmToken },
      update: {
        user_id: userId,
        platform,
        device_id: deviceId,
        updated_at: new Date(),
      },
      create: {
        user_id: userId,
        token: fcmToken,
        platform,
        device_id: deviceId,
      },
    });

    // Đăng ký token vào topic user_${userId}
    try {
      await admin.messaging().subscribeToTopic(fcmToken, `user_${userId}`);
      this.logger.log(`Đã đăng ký token ${fcmToken} vào topic user_${userId}`);
    } catch (error) {
      this.logger.error(`Lỗi khi đăng ký topic cho token ${fcmToken}: ${error.message}`);
    }

    return { message: 'FCM Token đã được cập nhật' };
  }
}
// notification/notification.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as sendgrid from '@sendgrid/mail';
import { Twilio } from 'twilio';
import { DatabaseService } from '@app/database';
import { ConfigService } from '@nestjs/config';
import { retry } from 'ts-retry-promise';
import * as admin from 'firebase-admin';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetNotificationsDto } from './dto/get-notifications.dto';
import { ServiceAccount } from '@firebase/app-types';

enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
}

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

    // Initialize Firebase Admin SDK
    const firebaseCredentials = this.configService.get<ServiceAccount | string>('FIREBASE_CREDENTIALS');
    if (!firebaseCredentials) {
      this.logger.error('Thiếu cấu hình FIREBASE_CREDENTIALS');
      throw new BadRequestException('Thiếu cấu hình FIREBASE_CREDENTIALS');
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseCredentials),
      });
    }
  }

  async sendNotification(dto: CreateNotificationDto) {
    const { userId, message, channels = ['email', 'sms', 'push'] } = dto;
    this.logger.log(`Gửi thông báo đến người dùng ${userId}`);

    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      this.logger.warn(`Người dùng ${userId} không tìm thấy`);
      throw new BadRequestException('Người dùng không tìm thấy');
    }

    // Lưu thông báo vào database
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
      ).catch((error) => {
        this.logger.error(`Email failed for user ${userId}: ${error.message}`);
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
            to: user.phone.startsWith('+') ? user.phone : `+84${user.phone.slice(1)}`,
          }),
        { retries: 3, delay: 1000 },
      )
        .then(() => {
          // Bỏ qua MessageInstance
        })
        .catch((error) => {
          this.logger.error(`SMS failed for user ${userId}: ${error.message}`);
          this.updateNotificationStatus(notification.id, 'FAILED_SMS');
        });
      promises.push(smsPromise);
    }

    // Push notification
    if (channels.includes('push') && admin.apps.length) {
      const pushPromise = retry(
        () =>
          admin.messaging().sendToTopic(`user_${userId}`, {
            notification: {
              title: 'BarberShop Notification',
              body: message,
            },
            data: { notificationId: notification.id.toString() },
          }),
        { retries: 3, delay: 1000 },
      ).catch((error) => {
        this.logger.error(`Push notification failed for user ${userId}: ${error.message}`);
        this.updateNotificationStatus(notification.id, 'FAILED_PUSH');
      });
      promises.push(pushPromise);
    }

    await Promise.all(promises);
    this.logger.log(`Thông báo gửi thành công đến người dùng ${userId}`);
    return { message: 'Thông báo gửi thành công', notificationId: notification.id };
  }

  // ... Các phương thức khác giữ nguyên ...
}