import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InterviewCreatedEvent } from '../interview-created.event';
import { PrismaService } from '../../../../shared/database/prisma.service';

/**
 * Handler for InterviewCreatedEvent
 * Triggers company enrichment when a new interview is created
 */
@Injectable()
@EventsHandler(InterviewCreatedEvent)
export class InterviewCreatedHandler implements IEventHandler<InterviewCreatedEvent> {
  private readonly logger = new Logger(InterviewCreatedHandler.name);
  private readonly llmServiceUrl: string;
  private readonly llmApiKey: string;
  private readonly callbackBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.llmServiceUrl = this.configService.get<string>('LLM_SERVICE_URL', 'http://localhost:5000');
    this.llmApiKey = this.configService.get<string>('LLM_API_KEY', '');
    const configuredApiBaseUrl = this.configService.get<string>(
      'API_BASE_URL',
      this.configService.get<string>('API_URL', 'http://localhost:3000'),
    );
    const isLocalCallbackBase =
      configuredApiBaseUrl.includes('localhost') ||
      configuredApiBaseUrl.includes('127.0.0.1');
    this.callbackBaseUrl = isLocalCallbackBase
      ? 'https://api.resumecast.ai'
      : configuredApiBaseUrl;

    if (isLocalCallbackBase) {
      this.logger.warn(
        `Resolved local callback base (${configuredApiBaseUrl}). Falling back to ${this.callbackBaseUrl}`,
      );
    }
    
    if (!this.llmApiKey) {
      this.logger.warn('LLM_API_KEY not configured - LLM service calls may fail');
    }
  }

  /**
   * Get headers for LLM service requests.
   */
  private getLLMHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.llmApiKey,
    };
  }

  async handle(event: InterviewCreatedEvent): Promise<void> {
    this.logger.log(
      `Handling InterviewCreatedEvent for interview ${event.interviewId}, company: ${event.company}`,
    );

    try {
      // Check if company info already exists
      const existingCompany = await this.prisma.companyInfo.findFirst({
        where: {
          companyName: {
            equals: event.company,
            mode: 'insensitive',
          },
        },
      });

      if (!existingCompany) {
        this.logger.log(`Company "${event.company}" not found, creating placeholder and triggering enrichment`);
        
        // Create placeholder CompanyInfo with PENDING status
        const placeholderCompany = await this.prisma.companyInfo.create({
          data: {
            companyName: event.company,
            enrichmentStatus: 'PENDING',
            source: 'interview_trigger',
          },
        });

        // Link the interview to the placeholder
        await this.prisma.interviewProcess.update({
          where: { id: event.interviewId },
          data: { companyInfoId: placeholderCompany.id },
        });

        this.logger.log(`Created placeholder CompanyInfo ${placeholderCompany.id} with PENDING status`);

        // Trigger enrichment
        await this.triggerCompanyEnrichment(event.company, event.userId, placeholderCompany.id);
      } else if (existingCompany.enrichmentStatus === 'FAILED' || existingCompany.enrichmentStatus === 'PENDING') {
        // Retry enrichment for failed or stuck pending entries
        this.logger.log(`Company "${event.company}" exists but status is ${existingCompany.enrichmentStatus}, retrying enrichment`);
        await this.triggerCompanyEnrichment(event.company, event.userId, existingCompany.id);
      } else {
        this.logger.log(`Company "${event.company}" already exists with status ${existingCompany.enrichmentStatus}, skipping enrichment`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle InterviewCreatedEvent: ${error.message}`, error.stack);
      // Don't throw - side effects should not break main flow
    }
  }

  /**
   * Trigger company enrichment via LLM service
   */
  private async triggerCompanyEnrichment(companyName: string, userId: string, companyId?: string): Promise<void> {
    try {
      const callbackUrl = `${this.callbackBaseUrl}/api/webhooks/llm-result`;

      // Update status to PROCESSING
      if (companyId) {
        await this.prisma.companyInfo.update({
          where: { id: companyId },
          data: { enrichmentStatus: 'PROCESSING' },
        });
      }

      const response = await fetch(`${this.llmServiceUrl}/api/companies/enrich`, {
        method: 'POST',
        headers: this.getLLMHeaders(),
        body: JSON.stringify({
          companyName,
          callbackUrl,
          metadata: {
            userId,
            companyId,
            type: 'company_research',
            source: 'interview_created',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM service returned ${response.status}`);
      }

      const result = await response.json();
      this.logger.log(
        `Company enrichment queued: ${result.jobId} for company ${companyId || companyName} (callback: ${callbackUrl})`,
      );
    } catch (error) {
      this.logger.error(`Failed to trigger company enrichment: ${error.message}`);
      
      // Mark as FAILED if we have a companyId
      if (companyId) {
        await this.prisma.companyInfo.update({
          where: { id: companyId },
          data: { enrichmentStatus: 'FAILED' },
        }).catch(err => this.logger.error(`Failed to update status to FAILED: ${err.message}`));
      }
    }
  }
}
