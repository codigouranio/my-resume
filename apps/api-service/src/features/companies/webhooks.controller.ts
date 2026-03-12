import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { PrismaService } from '@shared/database/prisma.service';
import { EmailService } from '@shared/email/email.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { Request } from 'express';

/**
 * Webhook payload from LLM service
 */
interface LLMWebhookPayload {
  jobId: string;
  type: 'company' | 'position';
  status: 'completed' | 'failed';
  data?: any;
  error?: string;
  metadata?: {
    userId?: string;
    interviewId?: string;
    companyName?: string;
  };
}

/**
 * Controller for receiving webhooks from LLM service
 * This enables async communication without shared infrastructure
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly companiesService: CompaniesService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get('LLM_WEBHOOK_SECRET', 'change-me-in-production');
    
    if (this.webhookSecret === 'change-me-in-production') {
      this.logger.warn('⚠️  LLM_WEBHOOK_SECRET not set! Using default (INSECURE)');
    } else {
      this.logger.log(`✅ LLM_WEBHOOK_SECRET configured (${this.webhookSecret.substring(0, 10)}...)`);
    }
  }

  @Post('llm-result')
  @ApiOperation({
    summary: 'Receive research results from LLM service',
    description:
      'Webhook endpoint called by LLM service when company enrichment or position scoring completes. ' +
      'Request must include X-Webhook-Signature header for security.',
  })
  async handleLLMResult(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() payload: LLMWebhookPayload,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-job-id') jobId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Received webhook for job ${payload.jobId} (${payload.type}): ${payload.status}`);
    
    // Log what we received BEFORE any processing
    this.logger.log(`=== RECEIVED WEBHOOK (API) ===`);
    this.logger.log(`  Job ID: ${payload.jobId}`);
    this.logger.log(`  Signature Header: ${signature}`);
    this.logger.log(`  Received Payload (as parsed by NestJS):\n${JSON.stringify(payload, null, 2)}`);
    this.logger.log(`===============================`);

    // Verify webhook signature against RAW body (before parsing)
    if (!this.verifyWebhookSignature(req.rawBody, signature)) {
      this.logger.error(`Invalid webhook signature for job ${payload.jobId}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Validate payload
    if (!payload.jobId || !payload.type || !payload.status) {
      throw new BadRequestException('Missing required fields: jobId, type, status');
    }

    try {
      if (payload.status === 'failed') {
        await this.handleFailure(payload);
        return { success: true, message: 'Failure recorded' };
      }

      if (payload.type === 'company') {
        await this.handleCompanyResult(payload);
      } else if (payload.type === 'position') {
        await this.handlePositionResult(payload);
      } else {
        this.logger.warn(`Unknown webhook type: ${payload.type}`);
        throw new BadRequestException(`Unknown type: ${payload.type}`);
      }

      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(
        `Error processing webhook for job ${payload.jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256 against RAW request body
   */
  private verifyWebhookSignature(rawBody: Buffer | undefined, signature: string): boolean {
    if (!signature) {
      this.logger.warn('No webhook signature provided');
      return false;
    }

    if (!rawBody) {
      this.logger.error('No raw body available for signature verification');
      this.logger.error('Make sure rawBody: true is set in NestFactory.create()');
      return false;
    }

    try {
      // Compute expected signature from RAW body (before any parsing)
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      // Detailed debugging logs
      const payloadString = rawBody.toString('utf-8');
      const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
      
      this.logger.log(`=== WEBHOOK SIGNATURE DEBUG (API) ===`);
      this.logger.log(`  Secret (first 10): ${this.webhookSecret.substring(0, 10)}...`);
      this.logger.log(`  Raw Body length: ${rawBody.length} bytes`);
      this.logger.log(`  Payload SHA256: ${payloadHash}`);
      this.logger.log(`  FULL Raw Body:\n${payloadString}`);
      this.logger.log(`  Received Signature: ${signature}`);
      this.logger.log(`  Expected Signature: ${expectedSignature}`);
      this.logger.log(`  Signatures Match: ${signature === expectedSignature}`);
      this.logger.log(`======================================`);

      // Check if lengths match before timing-safe comparison
      if (signature.length !== expectedSignature.length) {
        this.logger.warn(
          `Signature length mismatch: received ${signature.length}, expected ${expectedSignature.length}`,
        );
        return false;
      }

      // Use timing-safe comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );

      if (!isValid) {
        this.logger.warn('Webhook signature validation failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Error verifying webhook signature: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle company enrichment result
   */
  private async handleCompanyResult(payload: LLMWebhookPayload): Promise<void> {
    const { data, metadata } = payload;

    if (!data || !data.companyName) {
      this.logger.warn(`No company data in webhook ${payload.jobId}`);
      return;
    }

    const { companyName, ...enrichedData } = data;
    const officialName = companyName;

    this.logger.log(`Processing company enrichment: ${officialName}${enrichedData.legalName ? ` (Legal: ${enrichedData.legalName})` : ''}`);

    // Convert data types for Prisma
    const dataForDb: any = { ...enrichedData };
    
    if (enrichedData.founded) {
      const foundedYear = parseInt(enrichedData.founded, 10);
      if (!isNaN(foundedYear)) {
        dataForDb.founded = foundedYear;
      } else {
        delete dataForDb.founded;
      }
    }

    // Save to database
    const companyInfo = await this.prisma.companyInfo.upsert({
      where: { companyName: officialName },
      create: {
        companyName: officialName,
        ...dataForDb,
        source: 'llm_webhook',
        enrichmentStatus: 'COMPLETED',
      },
      update: {
        ...dataForDb,
        source: 'llm_webhook',
        enrichmentStatus: 'COMPLETED',
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Saved company info: ${officialName} with status COMPLETED`);

    // Link and normalize interviews
    const linkedCount = await this.companiesService.linkToInterviews(officialName);
    if (linkedCount > 0) {
      this.logger.log(`Auto-linked ${linkedCount} interview(s) to ${officialName}`);
    }

    // Send email notification if we have userId
    if (metadata?.userId) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: metadata.userId },
          select: { email: true, firstName: true },
        });

        if (user) {
          await this.emailService.sendCompanyEnrichmentEmail(
            user.email,
            user.firstName || 'there',
            officialName,
            companyInfo,
          );
          this.logger.log(`Email sent to ${user.email}`);
        }
      } catch (emailError) {
        this.logger.error(`Failed to send email: ${emailError.message}`);
      }
    }

    this.logger.log(`Company enrichment webhook processed: ${officialName}`);
  }

  /**
   * Handle position scoring result
   */
  private async handlePositionResult(payload: LLMWebhookPayload): Promise<void> {
    const { data, metadata } = payload;

    if (!data || !metadata?.interviewId) {
      this.logger.warn(`Missing data or interviewId in webhook ${payload.jobId}`);
      return;
    }

    const { fitScore, analysis } = data;
    const { interviewId } = metadata;

    this.logger.log(`Processing position fit: Interview ${interviewId}, Score ${fitScore}/10`);

    // Update interview
    await this.prisma.interviewProcess.update({
      where: { id: interviewId },
      data: {
        fitScore,
        fitAnalysis: analysis ? JSON.stringify(analysis) : null,
      } as any,
    });

    this.logger.log(`Updated interview ${interviewId} with fit score: ${fitScore}/10`);

    // Optional: Send notification email
    try {
      const interview = await this.prisma.interviewProcess.findUnique({
        where: { id: interviewId },
        select: {
          company: true,
          position: true,
          user: {
            select: { email: true, firstName: true },
          },
        },
      });

      if (interview?.user) {
        this.logger.log(
          `Position fit complete: ${interview.position} at ${interview.company} = ${fitScore}/10`,
        );
        // Could send email here if desired
      }
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Handle failed research job
   */
  private async handleFailure(payload: LLMWebhookPayload): Promise<void> {
    const { error, metadata } = payload;
    
    this.logger.error(`LLM job ${payload.jobId} failed: ${error || 'Unknown error'}`);

    // Could store failure in database for tracking
    // Could send failure notification email
    
    if (metadata?.userId) {
      this.logger.log(`Notifying user ${metadata.userId} about failure`);
      // Optional: Send failure email
    }
  }
}
