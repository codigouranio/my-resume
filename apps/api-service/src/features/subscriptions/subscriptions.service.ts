import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/database/prisma.service';
import { EmailService } from '@shared/email/email.service';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  /**
   * Create a Stripe checkout session for PRO subscription
   */
  async createCheckoutSession(userId: string, priceId: string, successUrl: string, cancelUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      
      // Save customer ID to database
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
    });

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Create Stripe customer portal session for managing subscription
   */
  async createPortalSession(userId: string, returnUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event) {
    this.logger.log(`Processing webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      default:
        this.logger.warn(`Unhandled webhook event: ${event.type}`);
    }
  }

  /**
   * Handle successful checkout
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.error('No userId in checkout session metadata');
      return;
    }

    const subscriptionId = session.subscription as string;
    const subscription: any = await this.stripe.subscriptions.retrieve(subscriptionId);
    
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: 'PRO',
        stripeSubscriptionId: subscriptionId,
        subscriptionEndsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
      },
      select: { email: true, firstName: true },
    });

    this.logger.log(`User ${userId} upgraded to PRO`);

    // Send subscription upgrade email
    try {
      await this.emailService.sendSubscriptionUpgradeEmail(user.email, user.firstName);
    } catch (error) {
      this.logger.error(`Failed to send subscription upgrade email: ${error.message}`);
    }
  }

  /**
   * Handle subscription updates (renewals, plan changes)
   */
  private async handleSubscriptionUpdated(subscription: any) {
    const user = await this.prisma.user.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!user) {
      this.logger.error(`No user found for subscription ${subscription.id}`);
      return;
    }

    const status = subscription.status;
    const tier = status === 'active' || status === 'trialing' ? 'PRO' : 'FREE';

    // If downgrading from PRO to FREE, unpublish all resumes and clear custom domain
    if (user.subscriptionTier === 'PRO' && tier === 'FREE') {
      await this.handleDowngradeToFREE(user.id);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: tier,
        subscriptionEndsAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
      },
    });

    this.logger.log(`User ${user.id} subscription updated to ${tier}`);
  }

  /**
   * Handle subscription cancellation
   */
  private async handleSubscriptionDeleted(subscription: any) {
    const user = await this.prisma.user.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!user) {
      this.logger.error(`No user found for subscription ${subscription.id}`);
      return;
    }

    // Unpublish all resumes and clear custom domain
    await this.handleDowngradeToFREE(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: 'FREE',
        stripeSubscriptionId: null,
        subscriptionEndsAt: null,
      },
    });

    this.logger.log(`User ${user.id} downgraded to FREE`);
  }

  /**
   * Handle downgrade from PRO to FREE
   * - Unpublish all user's resumes
   * - Clear custom domain
   */
  private async handleDowngradeToFREE(userId: string) {
    // Unpublish all resumes
    await this.prisma.resume.updateMany({
      where: { userId },
      data: { isPublished: false },
    });

    // Clear custom domain
    await this.prisma.user.update({
      where: { id: userId },
      data: { customDomain: null },
    });

    this.logger.log(`User ${userId} resumes unpublished and custom domain cleared due to downgrade`);
  }

  /**
   * Admin method to upgrade a user to PRO by email
   */
  async upgradeUserToProByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, subscriptionTier: true },
    });

    if (!user) {
      throw new Error(`User with email ${email} not found`);
    }

    if (user.subscriptionTier === 'PRO') {
      return { message: 'User is already PRO', user };
    }

    // Upgrade to PRO
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: 'PRO' },
      select: { id: true, email: true, subscriptionTier: true, firstName: true, lastName: true },
    });

    this.logger.log(`User ${email} upgraded to PRO`);

    return { message: 'User upgraded to PRO successfully', user: updatedUser };
  }
}
