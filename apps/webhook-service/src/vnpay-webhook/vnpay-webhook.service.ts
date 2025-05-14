// apps/webhook-service/src/vnpay-webhook/vnpay-webhook.service.ts
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class VnpayWebhookService {
  private readonly logger = new Logger(VnpayWebhookService.name);

  constructor(
    @Inject('WEBHOOK_SERVICE') private readonly client: ClientProxy,
  ) {}

  async handleVnpayWebhook(query: any) {
    this.logger.log(
      `Nhận webhook từ VNPay, transaction: ${query.vnp_TransactionNo}`,
    );

    // Đẩy webhook vào RabbitMQ queue
    try {
      await firstValueFrom(this.client.emit('vnpay_webhook', query));
      this.logger.log(`Đẩy webhook VNPay vào queue vnpay_webhook thành công`);
    } catch (error) {
      this.logger.error(
        `Lỗi khi đẩy webhook VNPay vào queue: ${error.message}`,
      );
      throw new InternalServerErrorException('Lỗi khi đẩy webhook vào queue');
    }

    return { message: 'Webhook VNPay nhận thành công' };
  }
}
