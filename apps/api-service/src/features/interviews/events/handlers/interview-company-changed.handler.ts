import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Injectable, Logger } from '@nestjs/common';
import { InterviewCompanyChangedEvent } from '../interview-company-changed.event';
import { PrismaService } from '../../../../shared/database/prisma.service';

/**
 * Handler for InterviewCompanyChangedEvent
 * Triggers company enrichment when interview company name is updated
 */
@Injectable()
@EventsHandler(InterviewCompanyChangedEvent)
export class InterviewCompanyChangedHandler
  implements IEventHandler<InterviewCompanyChangedEvent>
{
  private readonly logger = new Logger(InterviewCompanyChangedHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(event: InterviewCompanyChangedEvent): Promise<void> {
    this.logger.log(
      `Handling InterviewCompanyChangedEvent for interview ${event.interviewId}: "${event.oldCompany}" → "${event.newCompany}"`,
    );

    try {
      // Check if new company info already exists
      const companyInfo = await this.prisma.companyInfo.findFirst({
        where: {
          companyName: {
            equals: event.newCompany,
            mode: 'insensitive',
          },
        },
      });

      // If company doesn't exist, trigger enrichment
      if (!companyInfo) {
        this.logger.log(`Company "${event.newCompany}" not found, triggering enrichment`);
        await this.triggerCompanyEnrichment(event.newCompany, event.userId);
      } else {
        this.logger.log(`Company "${event.newCompany}" already exists, skipping enrichment`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle InterviewCompanyChangedEvent: ${error.message}`,
        error.stack,
      );
      // Don't throw - side effects should not break main flow
    }
  }

  /**
   * Trigger company enrichment via LLM service
   */
  private async triggerCompanyEnrichment(companyName: string, userId: string): Promise<void> {
    const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:5000';
    const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';

    try {
      const response = await fetch(`${LLM_SERVICE_URL}/api/companies/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          callbackUrl: `${API_URL}/api/webhooks/llm-result`,
          metadata: {
            userId,
            type: 'company_research',
            source: 'interview_company_changed',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM service returned ${response.status}`);
      }

      const result = await response.json();
      this.logger.log(`Company enrichment queued: ${result.jobId}`);
    } catch (error) {
      this.logger.error(`Failed to trigger company enrichment: ${error.message}`);
    }
  }
}
