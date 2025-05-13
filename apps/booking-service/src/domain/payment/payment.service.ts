import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { RequestWithRawBody } from 'src/raw-body.middleware';
import { retry } from 'ts-retry-promise';
import { StripeProvider } from './provider/stripe.provider';
import { VNPayProvider } from './provider/vnpay.provider';
import { CashProvider } from './provider/cash.provider';

// Define return types for each provider's createPayment method
type StripeResponse = { clientSecret: string; paymentIntentId: string };
type VNPayResponse = { paymentUrl: string };
type CashResponse = { message: string };

// Union type for all possible provider responses
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
  private logger = new Logger(PaymentService.name);
  private paymentProviders: { [key: string]: PaymentProvider } = {};

  constructor(
    private databaseService: DatabaseService,
    private configService: ConfigService,
    private stripeProvider: StripeProvider,
    private vnpayProvider: VNPayProvider,
    private cashProvider: CashProvider,
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
  ) {
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

    // Save payment to database
    const paymentData = {
      booking_id: bookingId,
      payment_method: paymentMethod.toUpperCase() as any,
      status: 'PENDING' as const,
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
          {
            retries: 3,
            delay: 1000,
          },
        ).catch((err) => {
          this.logger.warn(`Retrying payment creation: ${err.message}`);
        }),
      ]);

      if (!providerResponse) {
        throw new BadRequestException(
          'Failed to create payment: No response from provider',
        );
      }

      // Type assertion for providerResponse based on paymentMethod
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
      } else if (paymentMethod.toLowerCase() === 'cash') {
        const cashResponse = providerResponse as CashResponse;
        // No additional update needed for cash
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

  async refundPayment(bookingId: number) {
    if (!bookingId || bookingId <= 0) {
      this.logger.error('Invalid bookingId for refund');
      throw new BadRequestException('Booking ID must be a positive number');
    }

    const payment = await this.databaseService.payment.findUnique({
      where: { booking_id: bookingId },
    });
    if (!payment || payment.status !== 'SUCCEEDED') {
      this.logger.error(
        `Payment not found or not succeeded for booking ${bookingId}`,
      );
      throw new BadRequestException('Payment not found or not succeeded');
    }
    if (payment.payment_method !== 'STRIPE') {
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
      await retry(() => provider.refundPayment!(payment.payment_intent_id!), {
        retries: 3,
        delay: 1000,
      }).catch((err) => {
        this.logger.warn(`Retrying : ${err.message}`);
      });
      await this.databaseService.payment.update({
        where: { booking_id: bookingId },
        data: { status: 'REFUNDED', updated_at: new Date() },
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

    try {
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
        return await provider.handleCallback(req.body, req.rawBody, signature);
      } else {
        return await provider.handleCallback(req.query);
      }
    } catch (error) {
      this.logger.error(`Callback handling failed: ${error.message}`);
      throw new BadRequestException(
        `Callback handling failed: ${error.message}`,
      );
    }
  }
}
