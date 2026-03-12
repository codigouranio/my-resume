import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { PrismaModule } from '@shared/database/prisma.module';
import { InterviewCreatedHandler, InterviewCompanyChangedHandler } from './events/handlers';

const EventHandlers = [InterviewCreatedHandler, InterviewCompanyChangedHandler];

@Module({
  imports: [PrismaModule, CqrsModule],
  controllers: [InterviewsController],
  providers: [InterviewsService, ...EventHandlers],
  exports: [InterviewsService],
})
export class InterviewsModule {}
