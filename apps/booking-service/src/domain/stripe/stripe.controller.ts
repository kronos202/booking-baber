import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Req,
  Headers,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Public } from 'src/common/decorators/public.decorator';
import { RequestWithRawBody } from 'src/raw-body.middleware';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('create-product')
  async createProduct(@Body() body: { name: string; description: string }) {
    return this.stripeService.createProduct(body.name, body.description);
  }

  @Post('create-price')
  async createPrice(
    @Body() body: { productId: string; unitAmount: number; currency: string },
  ) {
    return this.stripeService.createPrice(
      body.productId,
      body.unitAmount,
      body.currency,
    );
  }

  @Public()
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Body() body: { amount: number; reservationId: string },
  ) {
    return this.stripeService.createCheckoutSession(
      body.amount * 100,
      body.reservationId,
    );
  }

  // @Public()
  // @Post('webhook')
  // async handleStripeWebhook(
  //   @Req() req: RequestWithRawBody,
  //   @Headers('stripe-signature') signature: string,
  // ) {
  //   console.log('🚀 ~ StripeController ~ signature:', signature);
  //   const rawBody = req.rawBody;
  //   console.log('🚀 ~ StripeController ~ rawBody:', rawBody);
  //   try {
  //     const event = this.stripeService.stripe.webhooks.constructEvent(
  //       rawBody,
  //       signature,
  //       process.env.STRIPE_SIGNATURE_KEY!,
  //     );
  //     // Handle the event based on its type
  //     await this.stripeService.handleWebhookEvent(event);

  //     return {
  //       message: 'Received webhook',
  //     };
  //   } catch (err) {
  //     console.error('Webhook signature verification failed:', err.message);
  //     throw new HttpException(
  //       'Webhook signature verification failed',
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }
  // }
}
