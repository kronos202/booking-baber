// apps/webhook-service/src/google-webhook/google-webhook.controller.ts
import {
  Controller,
  Post,
  Query,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { GoogleWebhookService } from './google-webhook.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { GoogleWebhookDto } from './dto/google-webhook.dto';

@ApiTags('google-webhook')
@Controller('webhook/google-calendar')
export class GoogleWebhookController {
  private readonly logger = new Logger(GoogleWebhookController.name);

  constructor(private readonly googleWebhookService: GoogleWebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Nhận webhook từ Google Calendar' })
  @ApiResponse({ status: 200, description: 'Webhook nhận thành công' })
  @ApiResponse({ status: 400, description: 'Webhook không hợp lệ' })
  @ApiQuery({
    name: 'credentialId',
    required: true,
    description: 'ID thông tin xác thực Google',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Token xác thực webhook',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleGoogleCalendarWebhook(@Query() query: GoogleWebhookDto) {
    this.logger.log(
      `Nhận webhook Google Calendar, credentialId=${query.credentialId}`,
    );
    return this.googleWebhookService.handleGoogleCalendarWebhook(
      query.credentialId,
      query.token,
    );
  }
}
