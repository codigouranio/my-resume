import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompaniesWorkerService } from './companies.worker';
import { PositionScoringWorkerService } from './position-scoring.worker';
import { PrismaModule } from '@shared/database/prisma.module';
import { EmailModule } from '@shared/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesWorkerService, PositionScoringWorkerService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
