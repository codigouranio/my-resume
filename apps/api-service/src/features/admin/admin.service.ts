import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/database/prisma.service';
import { Role, SubscriptionTier } from '@prisma/client';
import { EmbeddingQueueService } from '../embeddings/embedding-queue.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly overviewCacheTtlMs = 30 * 1000;
  private overviewCache:
    | {
        expiresAt: number;
        data: any;
      }
    | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingQueueService: EmbeddingQueueService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  private async withTimeout<T>(
    operationName: string,
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<{ data: T | null; error: string | null }> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          clearTimeout(timeoutId);
          reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const data = await Promise.race([promise, timeoutPromise]);
      return { data, error: null };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `${operationName} is temporarily unavailable`;
      this.logger.warn(`Admin overview ${operationName} unavailable: ${message}`);
      return { data: null, error: message };
    }
  }

  async getOverview() {
    const now = Date.now();
    if (this.overviewCache && this.overviewCache.expiresAt > now) {
      return this.overviewCache.data;
    }

    const configuredPriceId = process.env.STRIPE_PRICE_ID ?? null;

    const [
      totalUsers,
      adminUsers,
      proUsers,
      enterpriseUsers,
      totalResumes,
      publishedResumes,
      customDomainUsers,
      queueResult,
      priceResult,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
      this.prisma.user.count({ where: { subscriptionTier: SubscriptionTier.PRO } }),
      this.prisma.user.count({
        where: { subscriptionTier: SubscriptionTier.ENTERPRISE },
      }),
      this.prisma.resume.count(),
      this.prisma.resume.count({ where: { isPublished: true } }),
      this.prisma.user.count({ where: { customDomain: { not: null } } }),
      this.withTimeout(
        'queue stats',
        this.embeddingQueueService.getQueueStats(),
        1200,
      ),
      configuredPriceId
        ? this.withTimeout(
            'stripe price lookup',
            this.subscriptionsService.getPriceDetails(configuredPriceId),
            1200,
          )
        : Promise.resolve({ data: null, error: null }),
    ]);

    const response = {
      counts: {
        totalUsers,
        adminUsers,
        proUsers,
        enterpriseUsers,
        totalResumes,
        publishedResumes,
        customDomainUsers,
      },
      queue: {
        stats: queueResult.data,
        error: queueResult.error,
        dashboardPath: '/api/admin/queues',
      },
      pricing: {
        configuredPriceId,
        details: priceResult.data,
        error: priceResult.error,
      },
      services: {
        llmServiceUrl: process.env.LLM_SERVICE_URL ?? null,
        nodeEnv: process.env.NODE_ENV ?? null,
      },
    };

    this.overviewCache = {
      expiresAt: now + this.overviewCacheTtlMs,
      data: response,
    };

    return response;
  }

  async getUsers(params: { search?: string; subscriptionTier?: string; limit?: number }) {
    const search = params.search?.trim();
    const requestedTier = params.subscriptionTier?.trim().toUpperCase();
    const subscriptionTier = Object.values(SubscriptionTier).includes(
      requestedTier as SubscriptionTier,
    )
      ? (requestedTier as SubscriptionTier)
      : undefined;
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);

    return this.prisma.user.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { customDomain: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(subscriptionTier ? { subscriptionTier } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        subscriptionTier: true,
        customDomain: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            resumes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  async upgradeUserToPro(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.subscriptionTier === SubscriptionTier.PRO) {
      return {
        message: 'User is already PRO',
        user,
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: SubscriptionTier.PRO,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        subscriptionTier: true,
      },
    });

    this.logger.log(`Admin upgraded user ${updatedUser.email} (${updatedUser.id}) to PRO`);

    return {
      message: 'User upgraded to PRO successfully',
      user: updatedUser,
    };
  }
}