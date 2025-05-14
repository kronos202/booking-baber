// apps/webhook-service/src/stripe-webhook/dto/stripe-webhook.dto.ts
import { IsString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StripeWebhookDto {
  @ApiProperty({
    description: 'Loại sự kiện Stripe',
    example: 'payment_intent.succeeded',
  })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Dữ liệu sự kiện Stripe', type: Object })
  @IsObject()
  data: { object: any };
}
