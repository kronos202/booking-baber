// apps/webhook-service/src/twilio-webhook/dto/twilio-webhook.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TwilioWebhookDto {
  @ApiProperty({ description: 'ID tin nhắn Twilio', example: 'SM123' })
  @IsString()
  @IsNotEmpty()
  MessageSid: string;

  @ApiProperty({ description: 'Trạng thái tin nhắn', example: 'delivered' })
  @IsString()
  @IsNotEmpty()
  MessageStatus: string;
}
