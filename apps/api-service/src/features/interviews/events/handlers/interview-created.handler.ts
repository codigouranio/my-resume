import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable, Logger } from '@nestjs/common';
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

  constructor(private readonly prisma: PrismaService) {}

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
    const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:5000';
    const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';

    try {
      // Update status to PROCESSING
      if (companyId) {
        await this.prisma.companyInfo.update({
          where: { id: companyId },
          data: { enrichmentStatus: 'PROCESSING' },
        });
      }

      const response = await fetch(`${LLM_SERVICE_URL}/api/companies/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          callbackUrl: `${API_URL}/api/webhooks/llm-result`,
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
      this.logger.log(`Company enrichment queued: ${result.jobId} for company ${companyId || companyName}`);
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
