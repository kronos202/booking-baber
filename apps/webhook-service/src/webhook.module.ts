import { Module } from '@nestjs/common';
import { StripeWebhookModule } from './stripe-webhook/stripe-webhook.module';
import { VnpayWebhookModule } from './vnpay-webhook/vnpay-webhook.module';
import { TwilioWebhookModule } from './twilio-webhook/twilio-webhook.module';
import { GoogleWebhookModule } from './google-webhook/google-webhook.module';

@Module({
  imports: [
    StripeWebhookModule,
    VnpayWebhookModule,
    TwilioWebhookModule,
    GoogleWebhookModule,
  ],
})
export class WebhookModule {}
