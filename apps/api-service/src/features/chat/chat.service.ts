import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { LlmServiceApiService } from '../llm-service-api/llm-service-api.service';
import { ChatSentiment } from '../llm-service-api/dto/log-chat-interaction.dto';
import * as crypto from 'crypto';

/**
 * Service for proxying chat requests to LLM service
 * Adds authentication and handles errors
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly llmServiceUrl: string;
  private readonly llmApiKey: string;
  private readonly llmTenantId: string;

  constructor(
    private configService: ConfigService,
    private llmServiceApiService: LlmServiceApiService,
  ) {
    this.llmServiceUrl =
      this.configService.get<string>('LLM_SERVICE_URL') ||
      'http://localhost:5000';
    this.llmApiKey = this.configService.get<string>('LLM_API_KEY') || '';
    this.llmTenantId = this.configService.get<string>('LLM_TENANT_ID') || 'default';

    if (!this.llmApiKey) {
      this.logger.warn(
        'LLM_API_KEY not configured - LLM service calls will fail',
      );
    }

    this.logger.log(
      `ChatService initialized with LLM_SERVICE_URL: ${this.llmServiceUrl}`,
    );
  }

  /**
   * Proxy chat request to LLM service
   * Adds API key/tenant authentication and handles errors
   */
  async chat(
    chatRequest: ChatRequestDto,
    requestMeta?: { ipAddress?: string; userAgent?: string; referrer?: string },
  ): Promise<ChatResponseDto> {
    const startTime = Date.now();
    this.logger.log(
      `[chat] Proxying request to LLM service - slug: ${chatRequest.slug}, conversationId: ${chatRequest.conversationId || 'none'}`,
    );

    try {
      const resume = await this.llmServiceApiService.getResumeForLlm(chatRequest.slug);
      const userInfo = await this.llmServiceApiService.getUserByResumeSlug(
        chatRequest.slug,
      );

      const conversationId = chatRequest.conversationId || crypto.randomUUID();
      const conversationHistory = await this.llmServiceApiService.getConversationHistory(
        chatRequest.slug,
        conversationId,
        6,
      );

      const llmEndpoint = `${this.llmServiceUrl}/api/chat`;
      this.logger.log(`[chat] Calling LLM endpoint: ${llmEndpoint}`);

      const response = await fetch(llmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.llmApiKey,
          'X-Tenant-Id': this.llmTenantId,
        },
        body: JSON.stringify({
          message: chatRequest.message,
          slug: chatRequest.slug,
          conversationId,
          resumeContext: resume.fullContext,
          userInfo: {
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            email: userInfo.email,
            role: userInfo.role,
            subscriptionTier: userInfo.subscriptionTier,
          },
          conversationHistory,
        }),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[chat] LLM service error (${response.status}): ${errorText}`,
        );
        throw new HttpException(
          `LLM service error: ${response.statusText}`,
          response.status,
        );
      }

      const data = await response.json();

      await this.llmServiceApiService.logChatInteraction({
        resumeSlug: chatRequest.slug,
        question: chatRequest.message,
        answer: data.response,
        responseTime: Number(data.responseTime) || duration,
        sessionId: data.conversationId || conversationId,
        sentiment:
          data.sentiment && Object.values(ChatSentiment).includes(data.sentiment)
            ? (data.sentiment as ChatSentiment)
            : undefined,
        topics: Array.isArray(data.topics) ? data.topics : [],
        ipAddress: requestMeta?.ipAddress,
        userAgent: requestMeta?.userAgent,
        referrer: requestMeta?.referrer,
      });

      this.logger.log(
        `[chat] Successfully received response from LLM service (${duration}ms)`,
      );

      return {
        response: data.response,
        conversationId: data.conversationId || conversationId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `[chat] Failed to call LLM service after ${duration}ms: ${error.message}`,
      );
      throw new HttpException(
        'Failed to connect to AI service',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
