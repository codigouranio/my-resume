import { Module } from '@nestjs/common';
import { ChatAnalyticsController } from './chat-analytics.controller';
import { ChatAnalyticsService } from './chat-analytics.service';
import { PrismaModule } from '@shared/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChatAnalyticsController],
  providers: [ChatAnalyticsService],
  exports: [ChatAnalyticsService],
})
export class ChatAnalyticsModule {}
