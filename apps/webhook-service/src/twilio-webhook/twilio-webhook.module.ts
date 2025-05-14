// apps/webhook-service/src/twilio-webhook/twilio-webhook.module.ts
import { Module } from '@nestjs/common';
import { TwilioWebhookService } from './twilio-webhook.service';
import { TwilioWebhookController } from './twilio-webhook.controller';
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
  controllers: [TwilioWebhookController],
  providers: [TwilioWebhookService],
  exports: [TwilioWebhookService],
})
export class TwilioWebhookModule {}
