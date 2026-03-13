import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { LlmServiceApiService } from './llm-service-api.service';
import { LogChatInteractionDto } from './dto/log-chat-interaction.dto';
import { LlmServiceLoginDto } from './dto/llm-auth.dto';

/**
 * Controller for LLM Service API endpoints
 * These endpoints allow the LLM service (running remotely) to interact
 * with the database without direct DB access
 */
@Controller('llm-service')
export class LlmServiceApiController {
  constructor(private readonly llmServiceApiService: LlmServiceApiService) {}

  /**
   * POST /api/llm-service/auth/login
   * Authenticate LLM service and receive JWT token
   * Public endpoint - uses username/password for authentication
   */
  @Post('auth/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LlmServiceLoginDto) {
    const isValid = this.llmServiceApiService.validateLlmServiceCredentials(
      dto.username,
      dto.password,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.llmServiceApiService.generateLlmServiceToken();
  }

  /**
   * GET /api/llm-service/resume/:slug
   * Get resume content and llmContext for AI processing
   * Requires authentication (JWT Bearer token or static token)
   */
  @Get('resume/:slug')
  @Public()
  async getResume(
    @Param('slug') slug: string,
    @Headers('authorization') authHeader: string,
    @Headers('x-llm-service-token') staticToken: string,
  ) {
    await this.validateAuthentication(authHeader, staticToken);
    return this.llmServiceApiService.getResumeForLlm(slug);
  }

  /**
   * GET /api/llm-service/resume/:slug/user
   * Get user information associated with a resume
   * Requires authentication (JWT Bearer token or static token)
   */
  @Get('resume/:slug/user')
  @Public()
  async getResumeUser(
    @Param('slug') slug: string,
    @Headers('authorization') authHeader: string,
    @Headers('x-llm-service-token') staticToken: string,
  ) {
    await this.validateAuthentication(authHeader, staticToken);
    return this.llmServiceApiService.getUserByResumeSlug(slug);
  }

  /**
   * POST /api/llm-service/chat/log
   * Log a chat interaction for analytics
   * Requires authentication (JWT Bearer token or static token)
   */
  @Post('chat/log')
  @Public()
  async logChatInteraction(
    @Body() dto: LogChatInteractionDto,
    @Headers('authorization') authHeader: string,
    @Headers('x-llm-service-token') staticToken: string,
  ) {
    await this.validateAuthentication(authHeader, staticToken);
    return this.llmServiceApiService.logChatInteraction(dto);
  }

  /**
   * GET /api/llm-service/resume/:slug/history/:sessionId
   * Get conversation history for a session
   * Requires authentication (JWT Bearer token or static token)
   */
  @Get('resume/:slug/history/:sessionId')
  @Public()
  async getConversationHistory(
    @Param('slug') slug: string,
    @Param('sessionId') sessionId: string,
    @Headers('authorization') authHeader: string,
    @Headers('x-llm-service-token') staticToken: string,
  ) {
    await this.validateAuthentication(authHeader, staticToken);
    return this.llmServiceApiService.getConversationHistory(slug, sessionId);
  }

  /**
   * Validate authentication - accepts both JWT Bearer tokens and static tokens
   * Throws UnauthorizedException if authentication fails
   */
  private async validateAuthentication(
    authHeader: string,
    staticToken: string,
  ): Promise<void> {
    const isValid = await this.llmServiceApiService.validateAuthentication(
      authHeader,
      staticToken,
    );

    if (!isValid) {
      throw new UnauthorizedException(
        'Invalid authentication. Provide either a valid Bearer token or X-LLM-Service-Token header',
      );
    }
  }
}
