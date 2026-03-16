import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import {
  createLLMResultsQueue,
  createLLMResultsWorker,
  LLMResearchResult,
  CompanyResearchResult,
  PositionResearchResult,
} from './llm-results.queue';
import { CompaniesService } from './companies.service';
import { PrismaService } from '@shared/database/prisma.service';
import { EmailService } from '@shared/email/email.service';
import { createRedisConfig } from '@shared/redis/redis.config';

/**
 * Worker service that processes research results from LLM service
 * This is part of the event-driven architecture where:
 * 1. API service sends research requests to LLM service via Redis queue
 * 2. LLM service processes and publishes results back via Redis queue
 * 3. This worker consumes those results and updates the database
 */
@Injectable()
export class LLMResultsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LLMResultsWorkerService.name);
  private worker: Worker<LLMResearchResult, void>;

  constructor(
    private readonly companiesService: CompaniesService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    const redisConfig = createRedisConfig(this.configService);

    // Initialize queue
    createLLMResultsQueue(redisConfig);

    // Create worker
    this.worker = createLLMResultsWorker(
      redisConfig,
      this.processResult.bind(this),
    );

    this.logger.log('LLM results worker initialized');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('LLM results worker closed');
    }
  }

  /**
   * Process a single result from LLM service
   */
  private async processResult(job: Job<LLMResearchResult>): Promise<void> {
    const { originalJobId, type, success } = job.data;

    this.logger.log(
      `Processing LLM result for ${type} (job ${originalJobId}): ${success ? 'SUCCESS' : 'FAILURE'}`,
    );

    if (!success) {
      const error = job.data.error || 'Unknown error';
      this.logger.error(`LLM research failed for job ${originalJobId}: ${error}`);
      // Could send failure email notification here
      return;
    }

    try {
      if (type === 'company') {
        await this.handleCompanyResult(job.data as CompanyResearchResult);
      } else if (type === 'position') {
        await this.handlePositionResult(job.data as PositionResearchResult);
      } else {
        this.logger.warn(`Unknown result type: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing ${type} result for job ${originalJobId}: ${error.message}`,
        error.stack,
      );
      throw error; // Let BullMQ retry
    }
  }

  /**
   * Handle company enrichment result
   */
  private async handleCompanyResult(result: CompanyResearchResult): Promise<void> {
    const { data, userId, originalJobId } = result;

    if (!data) {
      this.logger.warn(`No data in company result for job ${originalJobId}`);
      return;
    }

    const { companyName, ...enrichedData } = data;

    if (!companyName) {
      this.logger.warn(`No company name in result for job ${originalJobId}`);
      return;
    }

    this.logger.log(`Processing company enrichment result: ${companyName}`);

    // Use official name from LLM as the authoritative source
    const officialName = companyName;

    // Convert data types to match Prisma schema
    const dataForDb: any = {
      ...enrichedData,
      source: enrichedData.source || 'llm_research',
    };

    // Convert founded from string to number if needed
    if (enrichedData.founded) {
      const foundedYear = parseInt(enrichedData.founded, 10);
      if (!isNaN(foundedYear)) {
        dataForDb.founded = foundedYear;
      } else {
        delete dataForDb.founded; // Skip if not a valid year
      }
    }

    // Save to database with official name
    const companyInfo = await this.prisma.companyInfo.upsert({
      where: { companyName: officialName },
      create: {
        companyName: officialName,
        ...dataForDb,
      },
      update: {
        ...dataForDb,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Saved company info: ${officialName}`);

    // Link and normalize interviews
    // This will update all interviews with matching company name (case-insensitive)
    // to use the official name and link to the company info
    const linkedCount = await this.companiesService.linkToInterviews(companyName);
    if (linkedCount > 0) {
      this.logger.log(
        `Auto-linked and normalized ${linkedCount} interview(s) to ${officialName}`,
      );
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
          officialName,
          companyInfo,
        );
        this.logger.log(`Email sent successfully to ${user.email}`);
      } else {
        this.logger.warn(`User ${userId} not found, skipping email notification`);
      }
    } catch (emailError) {
      // Don't fail the job if email fails
      this.logger.error(
        `Failed to send email notification: ${emailError.message}`,
        emailError.stack,
      );
    }

    this.logger.log(`Company enrichment result processed successfully: ${officialName}`);
  }

  /**
   * Handle position scoring result
   */
  private async handlePositionResult(result: PositionResearchResult): Promise<void> {
    const { data, interviewId, originalJobId } = result;

    if (!data) {
      this.logger.warn(`No data in position result for job ${originalJobId}`);
      return;
    }

    const { fitScore, analysis } = data;

    this.logger.log(
      `Processing position fit result for interview ${interviewId}: Score ${fitScore}/10`,
    );

    // Update interview with fit score and analysis
    await this.prisma.interviewProcess.update({
      where: { id: interviewId },
      data: {
        fitScore,
        fitAnalysis: analysis ? JSON.stringify(analysis) : null,
      } as any, // Type assertion for prisma client
    });

    this.logger.log(`Updated interview ${interviewId} with fit score: ${fitScore}/10`);

    // Optional: Send email notification about fit score
    try {
      const interview = await this.prisma.interviewProcess.findUnique({
        where: { id: interviewId },
        select: {
          company: true,
          position: true,
          user: {
            select: {
              email: true,
              firstName: true,
            },
          },
        },
      });

      if (interview?.user) {
        this.logger.log(
          `Position fit analysis complete for ${interview.position} at ${interview.company}`,
        );
        // Could send email notification here if desired
        // await this.emailService.sendPositionFitEmail(...)
      }
    } catch (error) {
      // Don't fail if notification fails
      this.logger.error(`Failed to send position fit notification: ${error.message}`);
    }

    this.logger.log(`Position fit result processed successfully for interview ${interviewId}`);
  }
}
