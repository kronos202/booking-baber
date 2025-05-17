// apps/booking-service/src/payment/payment.controller.ts
import {
  Body,
  Controller,
  Post,
  Logger,
  Request,
  Response,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Response as ExpressResponse } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { RequestWithRawBody } from 'src/raw-body.middleware';

@ApiTags('payment')
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  @ApiOperation({ summary: 'Tạo thanh toán' })
  @ApiResponse({ status: 200, description: 'Thanh toán được tạo thành công' })
  @ApiBody({
    description: 'Thông tin thanh toán',
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'number', example: 1 },
        amount: { type: 'number', example: 100 },
        branchId: { type: 'number', example: 1 },
        paymentMethod: { type: 'string', example: 'stripe' },
      },
    },
  })
  async createPaymentIntent(
    @Body('bookingId') bookingId: number,
    @Body('amount') amount: number,
    @Body('branchId') branchId: number,
    @Body('paymentMethod') paymentMethod: string,
  ) {
    this.logger.debug(
      `Creating payment: bookingId=${bookingId}, method=${paymentMethod}`,
    );
    return this.paymentService.createPaymentIntent(
      bookingId,
      amount,
      branchId,
      paymentMethod,
    );
  }

  @Post('stripe/webhook')
  @ApiOperation({ summary: 'Xử lý webhook Stripe (dự phòng)' })
  @ApiResponse({ status: 200, description: 'Webhook xử lý thành công' })
  @ApiBody({ description: 'Payload webhook từ Stripe', type: Object })
  async handleStripeWebhook(
    @Request() req: RequestWithRawBody,
    @Response() res: ExpressResponse,
  ) {
    this.logger.debug('Received Stripe webhook (HTTP)');
    try {
      const result = await this.paymentService.handleCallback('stripe', req);
      res.status(200).json(result);
    } catch (error) {
      this.logger.error(`Stripe webhook error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }

  @Post('vnpay/callback')
  @ApiOperation({ summary: 'Xử lý callback VNPay (dự phòng)' })
  @ApiResponse({ status: 200, description: 'Callback xử lý thành công' })
  @ApiQuery({
    name: 'vnp_TxnRef',
    required: true,
    description: 'Mã tham chiếu giao dịch',
  })
  async handleVNPayCallback(
    @Request() req: RequestWithRawBody,
    @Response() res: ExpressResponse,
  ) {
    this.logger.debug('Received VNPay callback (HTTP)');
    try {
      const result = await this.paymentService.handleCallback('vnpay', req);
      res.status(200).json(result);
    } catch (error) {
      this.logger.error(`VNPay callback error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }

  @Post('twilio/webhook')
  @ApiOperation({ summary: 'Xử lý webhook Twilio (dự phòng)' })
  @ApiResponse({ status: 200, description: 'Webhook xử lý thành công' })
  @ApiBody({ description: 'Payload webhook từ Twilio', type: Object })
  async handleTwilioWebhook(
    @Body() body: any,
    @Response() res: ExpressResponse,
  ) {
    this.logger.debug('Received Twilio webhook (HTTP)');
    try {
      await this.paymentService.handleTwilioWebhook(body);
      res.status(200).json({ received: true });
    } catch (error) {
      this.logger.error(`Twilio webhook error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }
  @Post('refund')
  @ApiOperation({ summary: 'Hoàn tiền cho thanh toán' })
  @ApiResponse({ status: 200, description: 'Hoàn tiền thành công' })
  @ApiBody({
    description: 'Thông tin hoàn tiền',
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'number', example: 1 },
      },
    },
  })
  async refundPayment(@Body('bookingId') bookingId: number) {
    this.logger.debug(`Processing refund for ${bookingId}`);
    return this.paymentService.refundPayment(bookingId);
  }
}
