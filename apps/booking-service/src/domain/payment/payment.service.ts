// apps/booking-service/src/payment/payment.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service';
import { EventPattern } from '@nestjs/microservices';
import { retry } from 'ts-retry-promise';
import { StripeProvider } from './provider/stripe.provider';
import { VNPayProvider } from './provider/vnpay.provider';
import { CashProvider } from './provider/cash.provider';
import { DatabaseService } from 'src/database/database.service';
import { GoogleWebhookService } from '../../../../webhook-service/src/google-webhook/google-webhook.service';
import { PaymentMethod, PaymentStatus } from 'generated/prisma';
import { RequestWithRawBody } from 'src/raw-body.middleware';

// Define return types for each provider's createPayment method
type StripeResponse = { clientSecret: string; paymentIntentId: string };
type VNPayResponse = { paymentUrl: string };
type CashResponse = { message: string };
type ProviderResponse = StripeResponse | VNPayResponse | CashResponse;

// Interface for payment providers
interface PaymentProvider {
  createPayment(
    bookingId: number,
    amount: number,
    branchId: number,
  ): Promise<ProviderResponse>;
  handleCallback?(
    data: any,
    rawBody?: Buffer,
    signature?: string,
  ): Promise<any>;
  refundPayment?(paymentIntentId: string): Promise<void>;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly paymentProviders: { [key: string]: PaymentProvider } = {};

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly googleWebhookService: GoogleWebhookService,
    private readonly stripeProvider: StripeProvider,
    private readonly vnpayProvider: VNPayProvider,
    private readonly cashProvider: CashProvider,
  ) {
    this.paymentProviders = {
      stripe: this.stripeProvider,
      vnpay: this.vnpayProvider,
      cash: this.cashProvider,
    };
  }

  async createPaymentIntent(
    bookingId: number,
    amount: number,
    branchId: number,
    paymentMethod: string,
  ): Promise<any> {
    // Validation
    if (!bookingId || bookingId <= 0) {
      this.logger.error('Invalid bookingId');
      throw new BadRequestException('Booking ID must be a positive number');
    }
    if (!amount || amount <= 0) {
      this.logger.error('Invalid amount');
      throw new BadRequestException('Amount must be a positive number');
    }
    if (!branchId || branchId <= 0) {
      this.logger.error('Invalid branchId');
      throw new BadRequestException('Branch ID must be a positive number');
    }
    const validMethods = ['stripe', 'vnpay', 'cash'];
    if (!validMethods.includes(paymentMethod.toLowerCase())) {
      this.logger.error(`Unsupported payment method: ${paymentMethod}`);
      throw new BadRequestException('Unsupported payment method');
    }

    // Check booking
    const booking = await this.databaseService.booking.findUnique({
      where: { id: bookingId },
      select: { total_price: true },
    });
    if (!booking) {
      this.logger.error(`Booking not found: ${bookingId}`);
      throw new BadRequestException('Booking not found');
    }
    const finalAmount = amount || booking.total_price;

    // Ánh xạ paymentMethod sang enum PaymentMethod
    const paymentMethodMap: { [key: string]: PaymentMethod } = {
      stripe: PaymentMethod.STRIPE,
      vnpay: PaymentMethod.VN_PAY,
      cash: PaymentMethod.CASH,
    };
    const prismaPaymentMethod = paymentMethodMap[paymentMethod.toLowerCase()];
    if (!prismaPaymentMethod) {
      this.logger.error(`Invalid payment method mapping: ${paymentMethod}`);
      throw new BadRequestException('Invalid payment method');
    }

    // Save payment to database
    const paymentData = {
      booking_id: bookingId,
      payment_method: prismaPaymentMethod,
      status: PaymentStatus.PENDING, // Sử dụng enum PaymentStatus
      amount: finalAmount,
    };

    try {
      this.logger.debug(
        `Creating payment for booking ${bookingId}, method: ${paymentMethod}`,
      );
      const provider = this.paymentProviders[paymentMethod.toLowerCase()];
      if (!provider) {
        throw new BadRequestException('Payment provider not found');
      }

      const [payment, providerResponse] = await Promise.all([
        this.databaseService.payment.create({ data: paymentData }),
        retry(
          () =>
            provider.createPayment(bookingId, Number(finalAmount), branchId),
          { retries: 3, delay: 1000 },
        ).catch((err) => {
          this.logger.warn(`Retrying payment creation: ${err.message}`);
          throw err;
        }),
      ]);

      if (!providerResponse) {
        throw new BadRequestException(
          'Failed to create payment: No response from provider',
        );
      }

      if (paymentMethod.toLowerCase() === 'stripe') {
        const stripeResponse = providerResponse as StripeResponse;
        await this.databaseService.payment.update({
          where: { id: payment.id },
          data: { payment_intent_id: stripeResponse.paymentIntentId },
        });
      } else if (paymentMethod.toLowerCase() === 'vnpay') {
        const vnpayResponse = providerResponse as VNPayResponse;
        await this.databaseService.payment.update({
          where: { id: payment.id },
          data: { payment_url: vnpayResponse.paymentUrl },
        });
      }

      this.logger.log(`Payment created successfully for booking ${bookingId}`);
      return { payment, ...providerResponse };
    } catch (error) {
      this.logger.error(
        `Payment creation failed for booking ${bookingId}: ${error.message}`,
      );
      throw new BadRequestException(
        `Failed to create payment: ${error.message}`,
      );
    }
  }

  async refundPayment(bookingId: number): Promise<void> {
    if (!bookingId || bookingId <= 0) {
      this.logger.error('Invalid bookingId for refund');
      throw new BadRequestException('Booking ID must be a positive number');
    }

    const payment = await this.databaseService.payment.findUnique({
      where: { booking_id: bookingId },
    });
    if (!payment || payment.status !== PaymentStatus.SUCCEEDED) {
      this.logger.error(
        `Payment not found or not succeeded for booking ${bookingId}`,
      );
      throw new BadRequestException('Payment not found or not succeeded');
    }
    if (payment.payment_method !== PaymentMethod.STRIPE) {
      this.logger.error(
        `Only Stripe payments can be refunded, got ${payment.payment_method}`,
      );
      throw new BadRequestException('Only Stripe payments can be refunded');
    }
    if (!payment.payment_intent_id) {
      this.logger.error(`Missing payment_intent_id for booking ${bookingId}`);
      throw new BadRequestException('Payment intent ID is missing');
    }

    const provider = this.paymentProviders['stripe'];
    if (!provider.refundPayment) {
      this.logger.error('Refund method not available for Stripe provider');
      throw new BadRequestException(
        'Refund method not available for this provider',
      );
    }

    try {
      if (!provider.refundPayment) {
        throw new BadRequestException(
          'Refund method not available for this provider',
        );
      }
      await retry(() => provider.refundPayment!(payment.payment_intent_id!), {
        retries: 3,
        delay: 1000,
      });
      await this.databaseService.payment.update({
        where: { booking_id: bookingId },
        data: { status: PaymentStatus.REFUNDED, updated_at: new Date() },
      });
      this.logger.log(`Refund processed successfully for booking ${bookingId}`);
    } catch (error) {
      this.logger.error(
        `Refund failed for booking ${bookingId}: ${error.message}`,
      );
      throw new BadRequestException(
        `Failed to process refund: ${error.message}`,
      );
    }
  }

  @EventPattern('stripe_webhook')
  async handleStripeWebhook({
    payload,
    signature,
    rawBody,
  }: {
    payload: any;
    signature: string;
    rawBody: string;
  }) {
    this.logger.log(`Xử lý webhook Stripe từ queue: ${payload.type}`);

    const webhookLog = await this.databaseService.webhookLog.create({
      data: {
        provider: 'stripe',
        event: payload.type || 'unknown',
        payload,
        status: 'success',
      },
    });

    try {
      await this.stripeProvider.handleCallback(
        payload,
        Buffer.from(rawBody, 'base64'),
        signature,
      );
      this.logger.log(`Webhook Stripe xử lý thành công: ${payload.type}`);
    } catch (error) {
      this.logger.error(`Lỗi khi xử lý webhook Stripe: ${error.message}`);
      await this.databaseService.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'failed', error_message: error.message },
      });
      throw new InternalServerErrorException('Lỗi khi xử lý webhook');
    }
  }

  @EventPattern('vnpay_webhook')
  async handleVnpayWebhook(query: any) {
    this.logger.log(`Xử lý webhook VNPay từ queue: ${query.vnp_TransactionNo}`);

    const webhookLog = await this.databaseService.webhookLog.create({
      data: {
        provider: 'vnpay',
        event: 'payment',
        payload: query,
        status: 'success',
      },
    });

    try {
      await this.vnpayProvider.handleCallback(query);
      this.logger.log(`Webhook VNPay xử lý thành công`);
    } catch (error) {
      this.logger.error(`Lỗi khi xử lý webhook VNPay: ${error.message}`);
      await this.databaseService.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'failed', error_message: error.message },
      });
      throw new InternalServerErrorException('Lỗi khi xử lý webhook');
    }
  }

  @EventPattern('twilio_webhook')
  async handleTwilioWebhook(body: any) {
    this.logger.log(`Xử lý webhook Twilio từ queue: ${body.MessageSid}`);

    const webhookLog = await this.databaseService.webhookLog.create({
      data: {
        provider: 'twilio',
        event: body.MessageStatus,
        payload: body,
        status: 'success',
      },
    });

    try {
      const notification = await this.databaseService.notification.findFirst({
        where: { id: parseInt(body.MessageSid) },
      });
      if (!notification) {
        throw new BadRequestException('Không tìm thấy thông báo tương ứng');
      }

      const status =
        body.MessageStatus === 'delivered' ? 'SENT_SMS' : 'FAILED_SMS';
      await this.databaseService.notification.update({
        where: { id: notification.id },
        data: { delivery_status: status, updated_at: new Date() },
      });
      this.logger.log(`Webhook Twilio xử lý thành công: ${body.MessageSid}`);
    } catch (error) {
      this.logger.error(`Lỗi khi xử lý webhook Twilio: ${error.message}`);
      await this.databaseService.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'failed', error_message: error.message },
      });
      throw new InternalServerErrorException('Lỗi khi xử lý webhook');
    }
  }

  @EventPattern('google_calendar_webhook')
  async handleGoogleCalendarWebhook({
    credentialId,
    webhookToken,
  }: {
    credentialId: number;
    webhookToken: string;
  }) {
    this.logger.log(
      `Xử lý webhook Google Calendar từ queue: credentialId=${credentialId}`,
    );

    const webhookLog = await this.databaseService.webhookLog.create({
      data: {
        provider: 'google_calendar',
        event: 'calendar_sync',
        payload: { credentialId, webhookToken },
        status: 'success',
      },
    });

    try {
      await this.googleWebhookService.handleGoogleCalendarWebhook(
        credentialId,
        webhookToken,
      );
      this.logger.log(
        `Webhook Google Calendar xử lý thành công: credentialId=${credentialId}`,
      );
    } catch (error) {
      this.logger.error(
        `Lỗi khi xử lý webhook Google Calendar: ${error.message}`,
      );
      await this.databaseService.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'failed', error_message: error.message },
      });
      throw new InternalServerErrorException('Lỗi khi xử lý webhook');
    }
  }

  async handleCallback(paymentMethod: string, req: RequestWithRawBody) {
    this.logger.debug(`Handling callback for payment method: ${paymentMethod}`);
    const provider = this.paymentProviders[paymentMethod.toLowerCase()];
    if (!provider?.handleCallback) {
      this.logger.error(
        `No callback handler for payment method: ${paymentMethod}`,
      );
      throw new BadRequestException(
        'No callback handler for this payment method',
      );
    }

    const webhookLog = await this.databaseService.webhookLog.create({
      data: {
        provider: paymentMethod.toLowerCase(),
        event: req.body?.type || 'payment',
        payload: paymentMethod === 'stripe' ? req.body : req.query,
        status: 'success',
      },
    });

    try {
      let result;
      if (paymentMethod.toLowerCase() === 'stripe') {
        const signature = req.headers['stripe-signature'] as string;
        if (!signature) {
          this.logger.error('Missing stripe-signature header');
          throw new BadRequestException('Missing stripe-signature header');
        }
        if (!req.rawBody) {
          this.logger.error('Missing raw body for Stripe webhook');
          throw new BadRequestException('Missing raw body');
        }
        result = await provider.handleCallback(
          req.body,
          req.rawBody,
          signature,
        );
      } else {
        result = await provider.handleCallback(req.query);
      }
      this.logger.log(`Webhook ${paymentMethod} xử lý thành công`);
      return result;
    } catch (error) {
      this.logger.error(`Callback handling failed: ${error.message}`);
      await this.databaseService.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'failed', error_message: error.message },
      });
      throw new BadRequestException(
        `Callback handling failed: ${error.message}`,
      );
    }
  }
}
