import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { LlmServiceApiModule } from '../llm-service-api/llm-service-api.module';

/**
 * Module for chat functionality
 * Provides proxy endpoints for frontend to communicate with LLM service
 */
@Module({
  imports: [ConfigModule, LlmServiceApiModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
