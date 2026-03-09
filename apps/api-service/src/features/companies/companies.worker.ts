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

    try {
      // Call the enrichment service
      const enrichedData = await this.companiesService.enrichCompany(companyName);

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
