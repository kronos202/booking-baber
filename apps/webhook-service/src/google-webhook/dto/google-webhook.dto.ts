// apps/webhook-service/src/google-webhook/dto/google-webhook.dto.ts
import { IsInt, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleWebhookDto {
  @ApiProperty({ description: 'ID thông tin xác thực Google', example: 1 })
  @IsInt()
  @IsNotEmpty()
  credentialId: number;

  @ApiProperty({
    description: 'Token xác thực webhook',
    example: 'your_webhook_token',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
