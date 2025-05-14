// apps/webhook-service/src/vnpay-webhook/vnpay-webhook.module.ts
import { Module } from '@nestjs/common';
import { VnpayWebhookService } from './vnpay-webhook.service';
import { VnpayWebhookController } from './vnpay-webhook.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'WEBHOOK_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'webhook_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [VnpayWebhookController],
  providers: [VnpayWebhookService],
  exports: [VnpayWebhookService],
})
export class VnpayWebhookModule {}
