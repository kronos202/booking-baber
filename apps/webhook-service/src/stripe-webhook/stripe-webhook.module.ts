// apps/webhook-service/src/stripe-webhook/stripe-webhook.module.ts
import { Module } from '@nestjs/common';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeWebhookController } from './stripe-webhook.controller';
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
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService],
  exports: [StripeWebhookService],
})
export class StripeWebhookModule {}
