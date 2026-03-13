import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@shared/database/prisma.service';

/**
 * Background service that cleans up stuck enrichment processes
 * Runs every 5 minutes to check for companies stuck in PROCESSING status
 */
@Injectable()
export class EnrichmentCleanupService implements OnModuleInit {
  private readonly logger = new Logger(EnrichmentCleanupService.name);
  private cleanupInterval: NodeJS.Timeout;

  // Consider a company stuck if PROCESSING for more than 5 minutes
  private readonly STUCK_THRESHOLD_MS = 5 * 60 * 1000;
  
  // Run cleanup every 5 minutes
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('Enrichment cleanup service initialized');
    
    // Run cleanup immediately on startup
    this.runCleanup();
    
    // Then run every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.logger.log('Enrichment cleanup service stopped');
    }
  }

  /**
   * Find and reset stuck PROCESSING statuses to PENDING
   */
  private async runCleanup() {
    try {
      const stuckThreshold = new Date(Date.now() - this.STUCK_THRESHOLD_MS);

      // Find companies stuck in PROCESSING for > 5 minutes
      const stuckCompanies = await this.prisma.companyInfo.findMany({
        where: {
          enrichmentStatus: 'PROCESSING',
          updatedAt: {
            lt: stuckThreshold, // Updated more than 5 minutes ago
          },
        },
        select: {
          id: true,
          companyName: true,
          updatedAt: true,
        },
      });

      if (stuckCompanies.length === 0) {
        this.logger.debug('No stuck enrichment processes found');
        return;
      }

      this.logger.warn(
        `Found ${stuckCompanies.length} stuck enrichment process(es), resetting to PENDING`,
      );

      // Reset all stuck companies to PENDING
      const result = await this.prisma.companyInfo.updateMany({
        where: {
          id: {
            in: stuckCompanies.map((c) => c.id),
          },
        },
        data: {
          enrichmentStatus: 'PENDING',
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Reset ${result.count} stuck enrichment process(es) to PENDING. ` +
        `Companies: ${stuckCompanies.map((c) => c.companyName).join(', ')}`,
      );

      // Log details for each company
      stuckCompanies.forEach((company) => {
        const stuckDuration = Date.now() - company.updatedAt.getTime();
        const minutes = Math.floor(stuckDuration / 60000);
        this.logger.log(
          `  - ${company.companyName} (stuck for ${minutes} minutes)`,
        );
      });

    } catch (error) {
      this.logger.error(
        `Error during enrichment cleanup: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manually trigger cleanup (for testing or admin endpoints)
   */
  async triggerManualCleanup(): Promise<number> {
    await this.runCleanup();
    
    // Return count of companies currently in PENDING status
    const pendingCount = await this.prisma.companyInfo.count({
      where: { enrichmentStatus: 'PENDING' },
    });
    
    return pendingCount;
  }
}
