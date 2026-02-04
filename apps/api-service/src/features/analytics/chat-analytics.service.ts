import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/database/prisma.service';

@Injectable()
export class ChatAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all chat interactions for a resume
   */
  async getChatInteractions(
    resumeId: string,
    startDate?: Date,
    endDate?: Date,
    sentiment?: string,
  ) {
    const where: any = { resumeId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (sentiment) {
      where.sentiment = sentiment;
    }

    return this.prisma.chatInteraction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100
    });
  }

  /**
   * Get aggregated topic statistics for a resume
   */
  async getTopicStats(resumeId: string) {
    // Get all chat interactions for this resume
    const interactions = await this.prisma.chatInteraction.findMany({
      where: { resumeId },
      select: { topics: true, sentiment: true },
    });

    // Count topics
    const topicCounts: Record<
      string,
      { total: number; negative: number }
    > = {};

    interactions.forEach((interaction) => {
      interaction.topics.forEach((topic) => {
        if (!topicCounts[topic]) {
          topicCounts[topic] = { total: 0, negative: 0 };
        }
        topicCounts[topic].total++;
        if (interaction.sentiment === 'NEGATIVE') {
          topicCounts[topic].negative++;
        }
      });
    });

    // Convert to array and sort by total count
    return Object.entries(topicCounts)
      .map(([topic, counts]) => ({
        topic,
        count: counts.total,
        negativeCount: counts.negative,
        successRate:
          counts.total > 0
            ? ((counts.total - counts.negative) / counts.total) * 100
            : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get trend data for a resume (daily aggregations)
   */
  async getTrendData(
    resumeId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = { resumeId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const interactions = await this.prisma.chatInteraction.findMany({
      where,
      select: { createdAt: true, sentiment: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dateGroups: Record<
      string,
      { total: number; positive: number; neutral: number; negative: number }
    > = {};

    interactions.forEach((interaction) => {
      let dateKey: string;
      const date = new Date(interaction.createdAt);

      if (period === 'daily') {
        dateKey = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        // Get week start (Monday)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + 1);
        dateKey = weekStart.toISOString().split('T')[0];
      } else {
        // monthly
        dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      }

      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = {
          total: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
        };
      }

      dateGroups[dateKey].total++;
      if (interaction.sentiment === 'POSITIVE') {
        dateGroups[dateKey].positive++;
      } else if (interaction.sentiment === 'NEUTRAL') {
        dateGroups[dateKey].neutral++;
      } else if (interaction.sentiment === 'NEGATIVE') {
        dateGroups[dateKey].negative++;
      }
    });

    return Object.entries(dateGroups)
      .map(([date, counts]) => ({
        date,
        ...counts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get learning gaps - topics with poor answer rates
   */
  async getLearningGaps(resumeId: string) {
    const topicStats = await this.getTopicStats(resumeId);

    // Filter for topics with low success rate (< 60%)
    return topicStats
      .filter((stat) => stat.successRate < 60 && stat.count >= 3) // At least 3 questions
      .map((stat) => ({
        topic: stat.topic,
        questionCount: stat.count,
        unansweredCount: stat.negativeCount,
        successRate: stat.successRate,
        recommendation: this.getTopicRecommendation(stat.topic),
      }))
      .sort((a, b) => a.successRate - b.successRate);
  }

  /**
   * Get summary statistics for a resume
   */
  async getSummaryStats(resumeId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const interactions = await this.prisma.chatInteraction.findMany({
      where: {
        resumeId,
        createdAt: { gte: startDate },
      },
    });

    const totalQuestions = interactions.length;
    const positiveSentiment = interactions.filter(
      (i) => i.sentiment === 'POSITIVE',
    ).length;
    const negativeSentiment = interactions.filter(
      (i) => i.sentiment === 'NEGATIVE',
    ).length;
    const neutralSentiment = interactions.filter(
      (i) => i.sentiment === 'NEUTRAL',
    ).length;

    const avgResponseTime =
      totalQuestions > 0
        ? interactions.reduce((sum, i) => sum + (i.responseTime || 0), 0) /
          totalQuestions
        : 0;

    // Get unique sessions
    const uniqueSessions = new Set(
      interactions.map((i) => i.sessionId).filter(Boolean),
    ).size;

    return {
      totalQuestions,
      uniqueSessions,
      avgResponseTime: Math.round(avgResponseTime),
      sentimentBreakdown: {
        positive: positiveSentiment,
        neutral: neutralSentiment,
        negative: negativeSentiment,
      },
      successRate:
        totalQuestions > 0
          ? ((positiveSentiment + neutralSentiment) / totalQuestions) * 100
          : 0,
    };
  }

  /**
   * Get topic recommendation based on topic type
   */
  private getTopicRecommendation(topic: string): string {
    const recommendations: Record<string, string> = {
      skills:
        'Consider adding a dedicated "Technical Skills" section with detailed technology proficiency',
      experience:
        'Expand your work experience section with more specific details about your roles and achievements',
      education:
        'Add more information about your education, certifications, or training',
      projects:
        'Include a "Projects" section highlighting personal or professional projects',
      aws: 'Add specific AWS certifications and services you have experience with',
      python: 'List Python frameworks, libraries, and project examples',
      javascript:
        'Detail your JavaScript/TypeScript experience including frameworks (React, Node.js, etc.)',
      docker:
        'Mention containerization experience, Docker, Kubernetes, and orchestration tools',
      leadership:
        'Highlight leadership experience, team management, and mentoring achievements',
      compensation:
        'Consider adding salary expectations or compensation preferences to the hidden context',
      general:
        'Add more comprehensive information to address common questions',
    };

    return (
      recommendations[topic] ||
      `Add more information about ${topic} to your resume`
    );
  }

  /**
   * Verify user owns the resume
   */
  async verifyResumeOwnership(resumeId: string, userId: string) {
    const resume = await this.prisma.resume.findUnique({
      where: { id: resumeId },
      select: { userId: true },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    return resume.userId === userId;
  }
}
