import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ChatService } from './chat.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

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
  async chat(@Body() chatRequest: ChatRequestDto): Promise<ChatResponseDto> {
    this.logger.log(
      `[chat] Request received - slug: ${chatRequest.slug}, message length: ${chatRequest.message.length}`,
    );

    const response = await this.chatService.chat(chatRequest);

    this.logger.log(
      `[chat] Response sent - conversationId: ${response.conversationId}, response length: ${response.response.length}`,
    );

    return response;
  }
}
