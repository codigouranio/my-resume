import {
  Controller,
  Post,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  Get,
  Param,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import Stripe from 'stripe';
import { Public } from '../auth/decorators/public.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  private stripe: Stripe;

  constructor(private subscriptionsService: SubscriptionsService) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  /**
   * Create checkout session to upgrade to PRO
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(@Req() req: Request & { user: { id: string } }, @Body() body: { priceId: string }) {
    const userId = req.user.id;
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
   * Public endpoint to fetch Stripe price details for UI display
   */
  @Get('prices/:productId')
  @Public()
  async getPrice(@Param('productId') productId: string) {
    if (!productId) {
      throw new BadRequestException('productId is required');
    }

    let priceId: string;
    if (productId === 'SUBSCRIPTION_PRO') {
      priceId = process.env.STRIPE_PRICE_ID ;
    } else {
      throw new BadRequestException('Invalid productId');
    }

    return this.subscriptionsService.getPriceDetails(priceId);
  }

  /**
   * Create customer portal session for managing subscription
   */
  @Post('portal')
  @UseGuards(JwtAuthGuard)
  async createPortal(@Req() req: Request & { user: { id: string } }) {
    const userId = req.user.id;
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

  /**
   * Admin endpoint to upgrade a user to PRO (requires admin token)
   */
  @Post('admin/upgrade-user')
  async upgradeUserToPro(
    @Headers('x-admin-token') adminToken: string,
    @Body() body: { email: string },
  ) {
    const expectedToken = process.env.ADMIN_UPGRADE_TOKEN || 'change-me-in-production';
    
    if (!adminToken || adminToken !== expectedToken) {
      throw new UnauthorizedException('Invalid admin token');
    }

    if (!body.email) {
      throw new BadRequestException('Email is required');
    }

    return this.subscriptionsService.upgradeUserToProByEmail(body.email);
  }
}
