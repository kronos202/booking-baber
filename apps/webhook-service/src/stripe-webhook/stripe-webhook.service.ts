// apps/webhook-service/src/stripe-webhook/stripe-webhook.service.ts
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    @Inject('WEBHOOK_SERVICE') private readonly client: ClientProxy,
  ) {}

  async handleStripeWebhook(payload: any, signature: string, rawBody: Buffer) {
    this.logger.log(`Nhận webhook từ Stripe, event type: ${payload.type}`);

    // Đẩy webhook vào RabbitMQ queue
    try {
      await firstValueFrom(
        this.client.emit('stripe_webhook', {
          payload,
          signature,
          rawBody: rawBody.toString('base64'),
        }),
      );
      this.logger.log(`Đẩy webhook Stripe vào queue stripe_webhook thành công`);
    } catch (error) {
      this.logger.error(
        `Lỗi khi đẩy webhook Stripe vào queue: ${error.message}`,
      );
      throw new InternalServerErrorException('Lỗi khi đẩy webhook vào queue');
    }

    return { message: 'Webhook Stripe nhận thành công' };
  }
}
