import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { DatabaseService } from 'src/database/database.service';
import { PaymentStatus } from '@prisma/client';

// Define return type for Stripe's createPayment
// type StripeResponse = { clientSecret: string; paymentIntentId: string };
type StripeResponse = { sessionId: string; sessionUrl: string };

@Injectable()
export class StripeProvider {
  private stripe: Stripe;
  private logger = new Logger(StripeProvider.name);

  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2025-04-30.basil',
    });
  }

  // async createPayment(
  //   bookingId: number,
  //   amount: number,
  //   branchId: number,
  // ): Promise<StripeResponse> {
  //   this.logger.debug(
  //     `Creating Stripe payment for booking ${bookingId}, amount: ${amount}`,
  //   );
  //   try {
  //     const paymentIntent = await this.stripe.paymentIntents.create({
  //       amount: Math.round(amount * 100),
  //       currency: 'usd',
  //       metadata: {
  //         bookingId: bookingId.toString(),
  //         branchId: branchId.toString(),
  //       },
  //     });
  //     return {
  //       clientSecret: paymentIntent.client_secret!,
  //       paymentIntentId: paymentIntent.id,
  //     };
  //   } catch (error) {
  //     this.logger.error(
  //       `Failed to create Stripe payment intent: ${error.message}`,
  //     );
  //     throw new BadRequestException('Failed to create Stripe payment intent');
  //   }
  // }

  async createPayment(
    bookingId: number,
    amount: number,
    branchId: number,
  ): Promise<StripeResponse> {
    this.logger.debug(
      `Creating Stripe Checkout Session for booking ${bookingId}, amount: ${amount}`,
    );
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'], // Hỗ trợ thẻ và chuyển khoản
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Cắt tóc - Booking #${bookingId}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: 'https://localhost:3000/success',
        cancel_url: 'https://localhost:3000/cancel',
        metadata: {
          bookingId: bookingId.toString(),
          branchId: branchId.toString(),
          customer_id: '1', // Thay bằng customer_id từ Booking
        },
      });
      return {
        sessionId: session.id,
        sessionUrl: session.url!,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create Stripe Checkout Session: ${error.message}`,
      );
      throw new BadRequestException('Failed to create Stripe Checkout Session');
    }
  }

  // async handleCallback(
  //   data: any,
  //   rawBody: Buffer,
  //   signature: string,
  // ): Promise<any> {
  //   const endpointSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
  //   this.logger.debug('Handling Stripe webhook');

  //   let event;
  //   try {
  //     event = this.stripe.webhooks.constructEvent(
  //       rawBody,
  //       signature,
  //       endpointSecret,
  //     );
  //     this.logger.debug(`Webhook event verified: ${event.type}`);
  //   } catch (err) {
  //     this.logger.error(`Webhook verification failed: ${err.message}`);
  //     throw new BadRequestException(
  //       `Webhook verification failed: ${err.message}`,
  //     );
  //   }

  //   if (event.type === 'payment_intent.succeeded') {
  //     const paymentIntent = event.data.object;
  //     const bookingId = parseInt(paymentIntent.metadata.bookingId);
  //     this.logger.debug(
  //       `Processing payment_intent.succeeded for booking ${bookingId}`,
  //     );

  //     await this.databaseService.payment.update({
  //       where: { booking_id: bookingId },
  //       data: { status: 'SUCCEEDED', updated_at: new Date() },
  //     });
  //     await this.databaseService.booking.update({
  //       where: { id: bookingId },
  //       data: { status: 'confirmed' },
  //     });
  //     this.logger.log(`Payment succeeded for booking ${bookingId}`);
  //   }

  //   return { received: true };
  // }

  async handleCallback(
    data: any,
    rawBody: Buffer,
    signature: string,
  ): Promise<any> {
    const endpointSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
    this.logger.debug('Handling Stripe webhook');

    let event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        endpointSecret,
      );
      this.logger.debug(`Webhook event verified: ${event.type}`);
    } catch (err) {
      this.logger.error(`Webhook verification failed: ${err.message}`);
      throw new BadRequestException(
        `Webhook verification failed: ${err.message}`,
      );
    }

    // Bỏ qua checkout.session.completed vì đã xử lý trong PaymentService
    if (event.type === 'checkout.session.completed') {
      return { received: true };
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const bookingId = parseInt(paymentIntent.metadata.bookingId);
      this.logger.debug(
        `Processing payment_intent.succeeded for booking ${bookingId}`,
      );

      await this.databaseService.payment.update({
        where: { booking_id: bookingId },
        data: { status: PaymentStatus.SUCCEEDED, updated_at: new Date() },
      });
      await this.databaseService.booking.update({
        where: { id: bookingId },
        data: { status: 'confirmed' },
      });
      this.logger.log(`Payment succeeded for booking ${bookingId}`);
    }

    return { received: true };
  }

  // async refundPayment(paymentIntentId: string): Promise<void> {
  //   this.logger.debug(
  //     `Refunding Stripe payment with intent ${paymentIntentId}`,
  //   );
  //   try {
  //     await this.stripe.refunds.create({
  //       payment_intent: paymentIntentId,
  //     });
  //     this.logger.log(
  //       `Refund successful for payment intent ${paymentIntentId}`,
  //     );
  //   } catch (error) {
  //     this.logger.error(`Refund failed: ${error.message}`);
  //     throw new BadRequestException('Failed to process refund');
  //   }
  // }

  async refundPayment(paymentIntentId: string): Promise<void> {
    this.logger.debug(
      `Refunding Stripe payment with intent ${paymentIntentId}`,
    );
    try {
      await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
      });
      this.logger.log(
        `Refund successful for payment intent ${paymentIntentId}`,
      );
    } catch (error) {
      this.logger.error(`Refund failed: ${error.message}`);
      throw new BadRequestException('Failed to process refund');
    }
  }
}
