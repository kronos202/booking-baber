// apps/webhook-service/src/twilio-webhook/twilio-webhook.controller.ts
import {
  Controller,
  Post,
  Body,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { TwilioWebhookService } from './twilio-webhook.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { TwilioWebhookDto } from './dto/twilio-webhook.dto';

@ApiTags('twilio-webhook')
@Controller('webhook/twilio')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private readonly twilioWebhookService: TwilioWebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Nhận webhook từ Twilio' })
  @ApiResponse({ status: 200, description: 'Webhook nhận thành công' })
  @ApiResponse({ status: 400, description: 'Webhook không hợp lệ' })
  @ApiBody({ type: TwilioWebhookDto, description: 'Payload webhook từ Twilio' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleTwilioWebhook(@Body() body: TwilioWebhookDto) {
    this.logger.log(`Nhận webhook Twilio, message SID: ${body.MessageSid}`);
    return this.twilioWebhookService.handleTwilioWebhook(body);
  }
}
