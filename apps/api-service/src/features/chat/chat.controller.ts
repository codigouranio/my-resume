import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ChatService } from './chat.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { Request } from 'express';

/**
 * Controller for chat endpoints
 * Proxies frontend chat requests to LLM service with authentication
 */
@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /api/chat
   * Proxy chat requests from frontend to LLM service
   * Public endpoint - no authentication required
   */
  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a chat message',
    description:
      'Proxy chat requests to LLM service. Adds API key authentication automatically.',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat response received',
    type: ChatResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request',
  })
  @ApiResponse({
    status: 503,
    description: 'LLM service unavailable',
  })
  async chat(
    @Body() chatRequest: ChatRequestDto,
    @Req() req: Request,
  ): Promise<ChatResponseDto> {
    this.logger.log(
      `[chat] Request received - slug: ${chatRequest.slug}, message length: ${chatRequest.message.length}`,
    );

    const response = await this.chatService.chat(chatRequest, {
      ipAddress:
        (req.headers['x-real-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string) ||
        req.ip,
      userAgent: req.headers['user-agent'] as string,
      referrer: req.headers['referer'] as string,
    });

    this.logger.log(
      `[chat] Response sent - conversationId: ${response.conversationId}, response length: ${response.response.length}`,
    );

    return response;
  }
}
