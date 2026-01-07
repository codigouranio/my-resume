import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ChatAnalyticsService } from './chat-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/analytics/chat')
@UseGuards(JwtAuthGuard)
export class ChatAnalyticsController {
  constructor(private readonly chatAnalyticsService: ChatAnalyticsService) {}

  /**
   * GET /api/analytics/chat/:resumeId/interactions
   * Get all chat interactions for a resume
   */
  @Get(':resumeId/interactions')
  async getInteractions(
    @Param('resumeId') resumeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sentiment') sentiment?: string,
    @Request() req?: any,
  ) {
    // Verify ownership
    const isOwner = await this.chatAnalyticsService.verifyResumeOwnership(
      resumeId,
      req.user.userId,
    );
    if (!isOwner) {
      throw new ForbiddenException(
        'You do not have permission to view these analytics',
      );
    }

    return this.chatAnalyticsService.getChatInteractions(
      resumeId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      sentiment,
    );
  }

  /**
   * GET /api/analytics/chat/:resumeId/topics
   * Get topic statistics for a resume
   */
  @Get(':resumeId/topics')
  async getTopics(@Param('resumeId') resumeId: string, @Request() req?: any) {
    const isOwner = await this.chatAnalyticsService.verifyResumeOwnership(
      resumeId,
      req.user.userId,
    );
    if (!isOwner) {
      throw new ForbiddenException(
        'You do not have permission to view these analytics',
      );
    }

    return this.chatAnalyticsService.getTopicStats(resumeId);
  }

  /**
   * GET /api/analytics/chat/:resumeId/trends
   * Get trend data for a resume
   */
  @Get(':resumeId/trends')
  async getTrends(
    @Param('resumeId') resumeId: string,
    @Query('period') period?: 'daily' | 'weekly' | 'monthly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    const isOwner = await this.chatAnalyticsService.verifyResumeOwnership(
      resumeId,
      req.user.userId,
    );
    if (!isOwner) {
      throw new ForbiddenException(
        'You do not have permission to view these analytics',
      );
    }

    return this.chatAnalyticsService.getTrendData(
      resumeId,
      period || 'daily',
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * GET /api/analytics/chat/:resumeId/learning-gaps
   * Get learning gaps (topics with poor answer rates)
   */
  @Get(':resumeId/learning-gaps')
  async getLearningGaps(
    @Param('resumeId') resumeId: string,
    @Request() req?: any,
  ) {
    const isOwner = await this.chatAnalyticsService.verifyResumeOwnership(
      resumeId,
      req.user.userId,
    );
    if (!isOwner) {
      throw new ForbiddenException(
        'You do not have permission to view these analytics',
      );
    }

    return this.chatAnalyticsService.getLearningGaps(resumeId);
  }

  /**
   * GET /api/analytics/chat/:resumeId/summary
   * Get summary statistics for a resume
   */
  @Get(':resumeId/summary')
  async getSummary(
    @Param('resumeId') resumeId: string,
    @Query('days') days?: string,
    @Request() req?: any,
  ) {
    const isOwner = await this.chatAnalyticsService.verifyResumeOwnership(
      resumeId,
      req.user.userId,
    );
    if (!isOwner) {
      throw new ForbiddenException(
        'You do not have permission to view these analytics',
      );
    }

    return this.chatAnalyticsService.getSummaryStats(
      resumeId,
      days ? parseInt(days, 10) : 30,
    );
  }
}
