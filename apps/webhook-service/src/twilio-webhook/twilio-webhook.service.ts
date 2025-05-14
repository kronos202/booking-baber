// apps/webhook-service/src/twilio-webhook/twilio-webhook.service.ts
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TwilioWebhookService {
  private readonly logger = new Logger(TwilioWebhookService.name);

  constructor(
    @Inject('WEBHOOK_SERVICE') private readonly client: ClientProxy,
  ) {}

  async handleTwilioWebhook(body: any) {
    this.logger.log(`Nhận webhook từ Twilio, message SID: ${body.MessageSid}`);

    // Đẩy webhook vào RabbitMQ queue
    try {
      await firstValueFrom(this.client.emit('twilio_webhook', body));
      this.logger.log(`Đẩy webhook Twilio vào queue twilio_webhook thành công`);
    } catch (error) {
      this.logger.error(
        `Lỗi khi đẩy webhook Twilio vào queue: ${error.message}`,
      );
      throw new InternalServerErrorException('Lỗi khi đẩy webhook vào queue');
    }

    return { message: 'Webhook Twilio nhận thành công' };
  }
}
