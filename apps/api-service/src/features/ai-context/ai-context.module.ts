import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../../shared/email/email.module';
import { AIContextService } from './ai-context.service';
import { AIContextController } from './ai-context.controller';

@Module({
  imports: [ConfigModule, EmailModule],
  controllers: [AIContextController],
  providers: [AIContextService],
  exports: [AIContextService],
})
export class AIContextModule {}
