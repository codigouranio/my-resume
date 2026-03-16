import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import {
  createCompanyEnrichmentQueue,
  createCompanyEnrichmentWorker,
  CompanyEnrichmentJob,
  CompanyEnrichmentResult,
} from './companies.queue';
import { CompaniesService } from './companies.service';
import { PrismaService } from '@shared/database/prisma.service';
import { EmailService } from '@shared/email/email.service';

/**
 * Worker service that processes company enrichment jobs from BullMQ
 */
@Injectable()
export class CompaniesWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CompaniesWorkerService.name);
  private worker: Worker<CompanyEnrichmentJob, CompanyEnrichmentResult>;

  constructor(
    private readonly companiesService: CompaniesService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    const redisConfig = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      tls: this.configService.get('REDIS_HOST')?.includes('upstash.io') ? {} : undefined,
    };

    // Initialize queue
    createCompanyEnrichmentQueue(redisConfig);

    // Create worker
    this.worker = createCompanyEnrichmentWorker(
      redisConfig,
      this.processJob.bind(this),
    );

    this.logger.log('Company enrichment worker initialized');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Company enrichment worker closed');
    }
  }

  /**
   * Process a single enrichment job
   */
  private async processJob(
    job: Job<CompanyEnrichmentJob>,
  ): Promise<CompanyEnrichmentResult> {
    const { companyName, userId } = job.data;

    this.logger.log(
      `Processing enrichment job ${job.id} for company: ${companyName}`,
    );

    const useWebhooks = this.configService.get('USE_LLM_WEBHOOKS', 'true') === 'true';

    try {
      if (useWebhooks) {
        // NEW: Async webhook mode - fire and forget
        this.logger.log(`Using webhook mode for ${companyName}`);
        
        const result = await this.companiesService.enrichCompanyAsync(
          companyName,
          userId,
          job.id as string,
        );

        this.logger.log(
          `Enrichment queued for ${companyName}. LLM will call webhook when complete.`,
        );

        // Job completes immediately - webhook will handle linking and email
        return {
          success: true,
          companyName,
          message: 'Enrichment queued, awaiting webhook callback',
          llmJobId: result.jobId,
        };
      } else {
        // OLD: Synchronous mode (deprecated, kept for backward compatibility)
        this.logger.log(`[CompanyWorker Job ${job.id}] Using SYNCHRONOUS mode for ${companyName}`);
        
        const enrichedData = await this.companiesService.enrichCompany(companyName);
        this.logger.log(`[CompanyWorker Job ${job.id}] Enrichment completed for ${companyName}, got ${Object.keys(enrichedData).length} fields`);

        this.logger.log(`Successfully enriched company: ${companyName}`);

        // Link enriched data to existing interviews
        const linkedCount = await this.companiesService.linkToInterviews(companyName);
        if (linkedCount > 0) {
          this.logger.log(`Auto-linked ${linkedCount} interview(s) to ${companyName}`);
        }

        // Send email notification to user
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, firstName: true },
          });

          if (user) {
            this.logger.log(`Sending enrichment notification email to ${user.email}`);
            await this.emailService.sendCompanyEnrichmentEmail(
              user.email,
              user.firstName || 'there',
              companyName,
              enrichedData,
            );
          } else {
            this.logger.warn(`User ${userId} not found, skipping email notification`);
          }
        } catch (emailError) {
          // Don't fail the job if email fails
          this.logger.error(`Failed to send email notification: ${emailError.message}`);
        }

        return {
          success: true,
          companyName,
          data: enrichedData,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to enrich company ${companyName}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        companyName,
        error: error.message,
      };
    }
  }
}
