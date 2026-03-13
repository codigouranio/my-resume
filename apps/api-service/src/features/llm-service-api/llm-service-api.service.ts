import { Injectable, NotFoundException, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/database/prisma.service';
import { ChatSentiment as PrismaChatSentiment } from '@prisma/client';
import { LogChatInteractionDto, ChatSentiment } from './dto/log-chat-interaction.dto';
import { LlmServiceLoginDto, LlmServiceTokenResponseDto } from './dto/llm-auth.dto';
import * as crypto from 'crypto';

/**
 * Service for LLM Service API operations
 * Provides data access methods for the remote LLM service
 */
@Injectable()
export class LlmServiceApiService {
  private readonly logger = new Logger(LlmServiceApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get resume for LLM processing including llmContext
   */
  async getResumeForLlm(slug: string) {
    const resume = await this.prisma.resume.findUnique({
      where: {
        slug,
        isPublic: true,
        isPublished: true,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        llmContext: true,
        userId: true,
      },
    });

    if (!resume) {
      throw new NotFoundException(`Resume with slug '${slug}' not found`);
    }

    // Combine content and llmContext for AI
    const fullContext = resume.llmContext
      ? `${resume.content}\n\n${resume.llmContext}`
      : resume.content;

    return {
      id: resume.id,
      slug: resume.slug,
      title: resume.title,
      content: resume.content,
      llmContext: resume.llmContext,
      fullContext,
      userId: resume.userId,
    };
  }

  /**
   * Get user information by resume slug
   */
  async getUserByResumeSlug(slug: string) {
    const resume = await this.prisma.resume.findUnique({
      where: {
        slug,
        isPublic: true,
        isPublished: true,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            subscriptionTier: true,
          },
        },
      },
    });

    if (!resume) {
      throw new NotFoundException(`Resume with slug '${slug}' not found`);
    }

    return {
      resumeId: resume.id,
      resumeSlug: resume.slug,
      resumeTitle: resume.title,
      ...resume.user,
    };
  }

  /**
   * Log a chat interaction
   */
  async logChatInteraction(dto: LogChatInteractionDto) {
    try {
      // Get resume ID from slug
      const resume = await this.prisma.resume.findUnique({
        where: { slug: dto.resumeSlug },
        select: { id: true },
      });

      if (!resume) {
        throw new NotFoundException(`Resume with slug '${dto.resumeSlug}' not found`);
      }

      // Create chat interaction
      const interaction = await this.prisma.chatInteraction.create({
        data: {
          resumeId: resume.id,
          question: dto.question,
          answer: dto.answer,
          responseTime: dto.responseTime,
          sessionId: dto.sessionId || null,
          sentiment: dto.sentiment as PrismaChatSentiment || null,
          topics: dto.topics || [],
          ipAddress: dto.ipAddress || null,
          userAgent: dto.userAgent || null,
          country: dto.country || null,
          referrer: dto.referrer || null,
        },
      });

      this.logger.log(
        `Logged chat interaction for resume ${dto.resumeSlug} (ID: ${interaction.id})`,
      );

      return { success: true, interactionId: interaction.id };
    } catch (error) {
      this.logger.error(`Failed to log chat interaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(slug: string, sessionId: string, limit: number = 6) {
    // Get resume ID
    const resume = await this.prisma.resume.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!resume) {
      throw new NotFoundException(`Resume with slug '${slug}' not found`);
    }

    // Get recent interactions
    const interactions = await this.prisma.chatInteraction.findMany({
      where: {
        resumeId: resume.id,
        sessionId: sessionId,
      },
      select: {
        question: true,
        answer: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Return in chronological order (oldest first)
    return interactions.reverse();
  }

  /**
   * Validate LLM service credentials
   * Compares username and password against environment variables using timing-safe comparison
   */
  validateLlmServiceCredentials(username: string, password: string): boolean {
    const expectedUsername = this.configService.get<string>('LLM_SERVICE_USERNAME', 'llm-service');
    const expectedPassword = this.configService.get<string>('LLM_SERVICE_PASSWORD', '');

    if (!expectedPassword) {
      this.logger.error('LLM_SERVICE_PASSWORD not configured in environment');
      return false;
    }

    // Timing-safe comparison to prevent timing attacks
    const usernameMatch = this.timingSafeEqual(username, expectedUsername);
    const passwordMatch = this.timingSafeEqual(password, expectedPassword);

    return usernameMatch && passwordMatch;
  }

  /**
   * Generate JWT token for LLM service
   */
  async generateLlmServiceToken(): Promise<LlmServiceTokenResponseDto> {
    const payload = {
      sub: 'llm-service',
      type: 'service',
      iat: Math.floor(Date.now() / 1000),
    };

    const expiresIn = 3600; // 1 hour in seconds

    const accessToken = this.jwtService.sign(payload, {
      expiresIn,
    });

    return {
      accessToken,
      expiresIn,
      tokenType: 'Bearer',
      issuedAt: payload.iat,
    };
  }

  /**
   * Validate JWT token
   * Returns decoded payload if valid, throws UnauthorizedException if invalid
   */
  async validateJwtToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      
      // Verify it's a service token
      if (payload.type !== 'service' || payload.sub !== 'llm-service') {
        throw new UnauthorizedException('Invalid service token');
      }

      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }

  /**
   * Validate authentication - accepts both static token and JWT
   * Returns true if valid, false otherwise
   */
  async validateAuthentication(authHeader: string, staticTokenHeader?: string): Promise<boolean> {
    // Try JWT Bearer token first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        await this.validateJwtToken(token);
        return true;
      } catch (error) {
        this.logger.debug(`JWT validation failed: ${error.message}`);
        // Continue to try static token
      }
    }

    // Fall back to static token (backward compatibility)
    if (staticTokenHeader) {
      const expectedStaticToken = this.configService.get<string>('LLM_SERVICE_TOKEN', '');
      if (expectedStaticToken && this.timingSafeEqual(staticTokenHeader, expectedStaticToken)) {
        this.logger.debug('Authenticated with static token (deprecated)');
        return true;
      }
    }

    return false;
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}
