import { Module } from '@nestjs/common';
import { AIContextService } from './ai-context.service';
import { AIContextController } from './ai-context.controller';

@Module({
  controllers: [AIContextController],
  providers: [AIContextService],
  exports: [AIContextService],
})
export class AIContextModule {}
