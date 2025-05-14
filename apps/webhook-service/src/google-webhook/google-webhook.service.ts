// apps/webhook-service/src/google-webhook/google-webhook.service.ts
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GoogleWebhookService {
  private readonly logger = new Logger(GoogleWebhookService.name);

  constructor(
    @Inject('WEBHOOK_SERVICE') private readonly client: ClientProxy,
  ) {}

  async handleGoogleCalendarWebhook(
    credentialId: number,
    webhookToken: string,
  ) {
    this.logger.log(
      `Nhận webhook Google Calendar, credentialId=${credentialId}`,
    );

    // Đẩy webhook vào RabbitMQ queue
    try {
      await firstValueFrom(
        this.client.emit('google_calendar_webhook', {
          credentialId,
          webhookToken,
        }),
      );
      this.logger.log(
        `Đẩy webhook Google Calendar vào queue google_calendar_webhook thành công`,
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi đẩy webhook Google Calendar vào queue: ${error.message}`,
      );
      throw new InternalServerErrorException('Lỗi khi đẩy webhook vào queue');
    }

    return { message: 'Webhook Google Calendar nhận thành công' };
  }
}
