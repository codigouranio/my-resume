import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompaniesWorkerService } from './companies.worker';
import { PrismaModule } from '@shared/database/prisma.module';
import { EmailModule } from '@shared/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesWorkerService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
