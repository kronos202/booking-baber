// apps/webhook-service/src/vnpay-webhook/vnpay-webhook.controller.ts
import {
  Controller,
  Post,
  Query,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { VnpayWebhookService } from './vnpay-webhook.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { VnpayWebhookDto } from './dto/vnpay-webhook.dto';

@ApiTags('vnpay-webhook')
@Controller('webhook/vnpay')
export class VnpayWebhookController {
  private readonly logger = new Logger(VnpayWebhookController.name);

  constructor(private readonly vnpayWebhookService: VnpayWebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Nhận webhook từ VNPay' })
  @ApiResponse({ status: 200, description: 'Webhook nhận thành công' })
  @ApiResponse({ status: 400, description: 'Webhook không hợp lệ' })
  @ApiQuery({
    name: 'vnp_TransactionNo',
    required: true,
    description: 'Mã giao dịch VNPay',
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleVnpayWebhook(@Query() query: VnpayWebhookDto) {
    this.logger.log(
      `Nhận webhook VNPay, transaction: ${query.vnp_TransactionNo}`,
    );
    return this.vnpayWebhookService.handleVnpayWebhook(query);
  }
}
