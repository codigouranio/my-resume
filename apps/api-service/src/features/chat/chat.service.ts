import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

/**
 * Service for proxying chat requests to LLM service
 * Adds authentication and handles errors
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly llmServiceUrl: string;
  private readonly llmApiKey: string;

  constructor(private configService: ConfigService) {
    this.llmServiceUrl =
      this.configService.get<string>('LLM_SERVICE_URL') ||
      'http://localhost:5000';
    this.llmApiKey = this.configService.get<string>('LLM_API_KEY') || '';

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
   * Adds API key authentication and handles errors
   */
  async chat(chatRequest: ChatRequestDto): Promise<ChatResponseDto> {
    const startTime = Date.now();
    this.logger.log(
      `[chat] Proxying request to LLM service - slug: ${chatRequest.slug}, conversationId: ${chatRequest.conversationId || 'none'}`,
    );

    try {
      const llmEndpoint = `${this.llmServiceUrl}/api/chat`;
      this.logger.log(`[chat] Calling LLM endpoint: ${llmEndpoint}`);

      const response = await fetch(llmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.llmApiKey,
        },
        body: JSON.stringify({
          message: chatRequest.message,
          slug: chatRequest.slug,
          conversationId: chatRequest.conversationId,
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
      this.logger.log(
        `[chat] Successfully received response from LLM service (${duration}ms)`,
      );

      return {
        response: data.response,
        conversationId: data.conversationId,
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
