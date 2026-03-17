import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

/**
 * Module for chat functionality
 * Provides proxy endpoints for frontend to communicate with LLM service
 */
@Module({
  imports: [ConfigModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
