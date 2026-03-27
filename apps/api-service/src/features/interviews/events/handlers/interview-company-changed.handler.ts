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
      const existingCompany = await this.prisma.companyInfo.findFirst({
        where: {
          companyName: {
            equals: event.newCompany,
            mode: 'insensitive',
          },
        },
      });

      if (!existingCompany) {
        this.logger.log(`Company "${event.newCompany}" not found, creating placeholder and triggering enrichment`);
        
        // Create placeholder CompanyInfo with PENDING status
        const placeholderCompany = await this.prisma.companyInfo.create({
          data: {
            companyName: event.newCompany,
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
        await this.triggerCompanyEnrichment(event.newCompany, event.userId, placeholderCompany.id);
      } else if (existingCompany.enrichmentStatus === 'FAILED' || existingCompany.enrichmentStatus === 'PENDING') {
        // Retry enrichment for failed or stuck pending entries
        this.logger.log(`Company "${event.newCompany}" exists but status is ${existingCompany.enrichmentStatus}, retrying enrichment`);
        await this.triggerCompanyEnrichment(event.newCompany, event.userId, existingCompany.id);
      } else {
        this.logger.log(`Company "${event.newCompany}" already exists with status ${existingCompany.enrichmentStatus}, skipping enrichment`);
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
  private async triggerCompanyEnrichment(companyName: string, userId: string, companyId?: string): Promise<void> {
    const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:5000';
    const configuredApiBaseUrl = process.env.API_BASE_URL || process.env.API_URL || 'http://localhost:3000';
    const isLocalCallbackBase =
      configuredApiBaseUrl.includes('localhost') ||
      configuredApiBaseUrl.includes('127.0.0.1');
    const callbackBaseUrl = isLocalCallbackBase
      ? 'https://api.resumecast.ai'
      : configuredApiBaseUrl;
    const callbackUrl = `${callbackBaseUrl}/api/webhooks/llm-result`;
    const LLM_API_KEY = process.env.LLM_API_KEY || '';

    this.logger.log(`[triggerCompanyEnrichment] START for company: "${companyName}", userId: ${userId}, companyId: ${companyId || 'N/A'}`);
    this.logger.log(`[triggerCompanyEnrichment] LLM_SERVICE_URL: ${LLM_SERVICE_URL}`);
    this.logger.log(`[triggerCompanyEnrichment] API_BASE_URL: ${configuredApiBaseUrl}`);
    if (isLocalCallbackBase) {
      this.logger.warn(`[triggerCompanyEnrichment] Local callback base detected (${configuredApiBaseUrl}). Using fallback ${callbackBaseUrl}`);
    }
    this.logger.log(`[triggerCompanyEnrichment] LLM_API_KEY configured: ${LLM_API_KEY ? 'YES (length: ' + LLM_API_KEY.length + ')' : 'NO'}`);

    try {
      // Update status to PROCESSING
      if (companyId) {
        this.logger.log(`[triggerCompanyEnrichment] Updating company ${companyId} status to PROCESSING`);
        await this.prisma.companyInfo.update({
          where: { id: companyId },
          data: { enrichmentStatus: 'PROCESSING' },
        });
        this.logger.log(`[triggerCompanyEnrichment] Company ${companyId} status updated to PROCESSING`);
      }

      const requestBody = {
        companyName,
        callbackUrl,
        metadata: {
          userId,
          companyId,
          type: 'company_research',
          source: 'interview_company_changed',
        },
      };

      const enrichUrl = `${LLM_SERVICE_URL}/api/companies/enrich`;
      this.logger.log(`[triggerCompanyEnrichment] Calling LLM service at: ${enrichUrl}`);
      this.logger.log(`[triggerCompanyEnrichment] Request body: ${JSON.stringify(requestBody)}`);

      const response = await fetch(enrichUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': LLM_API_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      this.logger.log(`[triggerCompanyEnrichment] LLM service responded with status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`[triggerCompanyEnrichment] LLM service error response: ${errorText}`);
        throw new Error(`LLM service returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      this.logger.log(`[triggerCompanyEnrichment] LLM service response: ${JSON.stringify(result)}`);
      this.logger.log(`[triggerCompanyEnrichment] SUCCESS - Company enrichment queued with jobId: ${result.jobId} for company ${companyId || companyName}`);
    } catch (error) {
      this.logger.error(`[triggerCompanyEnrichment] FAILED for company "${companyName}": ${error.message}`, error.stack);
      
      // Mark as FAILED if we have a companyId
      if (companyId) {
        this.logger.log(`[triggerCompanyEnrichment] Updating company ${companyId} status to FAILED`);
        await this.prisma.companyInfo.update({
          where: { id: companyId },
          data: { enrichmentStatus: 'FAILED' },
        }).catch(err => this.logger.error(`[triggerCompanyEnrichment] Failed to update status to FAILED: ${err.message}`));
      }
    }
  }
}
