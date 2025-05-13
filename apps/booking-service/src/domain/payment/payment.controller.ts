import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Request,
  Response,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { RequestWithRawBody } from 'src/raw-body.middleware';
import { Response as ExpressResponse } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}
  private logger = new Logger(PaymentController.name);

  @Post('create')
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
  async handleStripeWebhook(
    @Request() req: RequestWithRawBody,
    @Response() res: ExpressResponse,
  ) {
    this.logger.debug('Received Stripe webhook');
    try {
      const result = await this.paymentService.handleCallback('stripe', req);
      res.status(200).json(result);
    } catch (error) {
      this.logger.error(`Stripe webhook error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }

  @Get('vnpay/callback')
  async handleVNPayCallback(
    @Request() req: RequestWithRawBody,
    @Response() res: ExpressResponse,
  ) {
    this.logger.debug('Received VNPay callback');
    try {
      const result = await this.paymentService.handleCallback('vnpay', req);
      res.status(200).json(result);
    } catch (error) {
      this.logger.error(`VNPay callback error: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }

  @Post('refund')
  async refundPayment(@Body('bookingId') bookingId: number) {
    this.logger.debug(`Processing refund for ${bookingId}`);
    return this.paymentService.refundPayment(bookingId);
  }
}
