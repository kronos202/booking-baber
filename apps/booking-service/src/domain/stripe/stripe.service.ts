import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  public stripe: Stripe;
  constructor(private readonly logger: Logger) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }

  async createProduct(name: string, description: string) {
    return await this.stripe.products.create({
      name,
      description,
    });
  }

  async createPrice(productId: string, unitAmount: number, currency = 'usd') {
    return await this.stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency,
    });
  }

  async createCheckoutSession(amount: number, reservationId: string) {
    const frontendUrl = 'http://localhost:3000';

    return this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Property Reservation',
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: {
        reservationId,
      },
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/cancel`,
    });
  }

  // async handleWebhookEvent(event: Stripe.Event) {
  //   if (event.type === 'checkout.session.completed') {
  //     const session = event.data.object;
  //     const reservationId = session.metadata?.reservationId;

  //     if (reservationId) {
  //       try {
  //         await this.reservationService.updateStatusToPaid(reservationId);
  //         this.logger.log(`Reservation ${reservationId} marked as PAID`);
  //       } catch (error) {
  //         this.logger.error(
  //           `Failed to update reservation ${reservationId}`,
  //           error,
  //         );
  //       }
  //     } else {
  //       this.logger.warn('No reservationId found in metadata');
  //     }
  //   } else {
  //     this.logger.warn(`Unhandled Stripe event type: ${event.type}`);
  //   }
  // }
}
