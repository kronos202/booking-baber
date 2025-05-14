// apps/webhook-service/src/stripe-webhook/stripe-webhook.controller.ts
import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { StripeWebhookService } from './stripe-webhook.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { StripeWebhookDto } from './dto/stripe-webhook.dto';
import { RequestWithRawBody } from 'src/middlewares/raw-body.middleware';

@ApiTags('stripe-webhook')
@Controller('webhook/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Nhận webhook từ Stripe' })
  @ApiResponse({ status: 200, description: 'Webhook nhận thành công' })
  @ApiResponse({ status: 400, description: 'Webhook không hợp lệ' })
  @ApiBody({ type: StripeWebhookDto, description: 'Payload webhook từ Stripe' })
  async handleStripeWebhook(
    @Body() payload: StripeWebhookDto,
    @Headers('stripe-signature') signature: string,
    @Req() req: RequestWithRawBody,
  ) {
    if (!req.rawBody) {
      this.logger.error('Raw body không tồn tại cho webhook Stripe');
      throw new BadRequestException('Raw body không tồn tại');
    }

    this.logger.log(`Nhận webhook Stripe, event type: ${payload.type}`);
    return this.stripeWebhookService.handleStripeWebhook(
      payload,
      signature,
      req.rawBody,
    );
  }
}
