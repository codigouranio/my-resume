import {
  Controller,
  Post,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import Stripe from 'stripe';

@Controller('subscriptions')
export class SubscriptionsController {
  private stripe: Stripe;

  constructor(private subscriptionsService: SubscriptionsService) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  /**
   * Create checkout session to upgrade to PRO
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(@Req() req: Request & { user: { userId: string } }, @Body() body: { priceId: string }) {
    const userId = req.user.userId;
    const { priceId } = body;

    if (!priceId) {
      throw new BadRequestException('priceId is required');
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/dashboard?payment=success`;
    const cancelUrl = `${baseUrl}/dashboard?payment=canceled`;

    return this.subscriptionsService.createCheckoutSession(userId, priceId, successUrl, cancelUrl);
  }

  /**
   * Create customer portal session for managing subscription
   */
  @Post('portal')
  @UseGuards(JwtAuthGuard)
  async createPortal(@Req() req: Request & { user: { userId: string } }) {
    const userId = req.user.userId;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/dashboard`;

    return this.subscriptionsService.createPortalSession(userId, returnUrl);
  }

  /**
   * Webhook endpoint for Stripe events
   * Note: This endpoint must be excluded from global JSON parsing middleware
   * to access raw body for signature verification
   */
  @Post('webhooks/stripe')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    // Process the event
    await this.subscriptionsService.handleWebhook(event);

    return { received: true };
  }
}
