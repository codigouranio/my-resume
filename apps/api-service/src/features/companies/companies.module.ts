import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { WebhooksController } from './webhooks.controller';
import { CompaniesService } from './companies.service';
import { CompaniesWorkerService } from './companies.worker';
import { PositionScoringWorkerService } from './position-scoring.worker';
import { LLMResultsWorkerService } from './llm-results.worker';
import { EnrichmentCleanupService } from './enrichment-cleanup.service';
import { PrismaModule } from '@shared/database/prisma.module';
import { EmailModule } from '@shared/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [
    CompaniesController,
    WebhooksController, // NEW: Receives webhooks from LLM service
  ],
  providers: [
    CompaniesService,
    CompaniesWorkerService,
    PositionScoringWorkerService,
    LLMResultsWorkerService, // Kept for reference, can be removed later
    EnrichmentCleanupService, // NEW: Auto-cleanup stuck enrichments
  ],
  exports: [CompaniesService],
})
export class CompaniesModule {}
