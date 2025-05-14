// apps/webhook-service/src/google-webhook/google-webhook.module.ts
import { Module } from '@nestjs/common';
import { GoogleWebhookService } from './google-webhook.service';
import { GoogleWebhookController } from './google-webhook.controller';
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
  controllers: [GoogleWebhookController],
  providers: [GoogleWebhookService],
  exports: [GoogleWebhookService],
})
export class GoogleWebhookModule {}
