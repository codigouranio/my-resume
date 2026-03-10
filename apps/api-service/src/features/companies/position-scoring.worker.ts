import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import {
  createPositionScoringQueue,
  createPositionScoringWorker,
  PositionScoringJob,
  PositionScoringResult,
} from './position-scoring.queue';
import { PrismaService } from '@shared/database/prisma.service';
import axios from 'axios';

/**
 * Worker service that processes position scoring jobs from BullMQ
 */
@Injectable()
export class PositionScoringWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PositionScoringWorkerService.name);
  private worker: Worker<PositionScoringJob, PositionScoringResult>;
  private llmServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.llmServiceUrl = this.configService.get('LLM_SERVICE_URL', 'http://localhost:5000');
  }

  onModuleInit() {
    const redisConfig = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
    };

    // Initialize queue
    createPositionScoringQueue(redisConfig);

    // Create worker
    this.worker = createPositionScoringWorker(
      redisConfig,
      this.processJob.bind(this),
    );

    this.logger.log('Position scoring worker initialized');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Position scoring worker closed');
    }
  }

  /**
   * Process a single position scoring job
   */
  private async processJob(
    job: Job<PositionScoringJob>,
  ): Promise<PositionScoringResult> {
    const { interviewId, userId, company, position, jobUrl, jobDescription } = job.data;

    this.logger.log(
      `Processing scoring job ${job.id} for interview: ${interviewId} (${position} at ${company})`,
    );

    try {
      // Fetch additional context from database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          firstName: true,
          defaultResumeId: true,
          defaultResume: {
            select: {
              id: true,
              content: true,
              llmContext: true,
            },
          },
        },
      });

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const resume = user.defaultResume;
      if (!resume) {
        throw new Error(`No default resume found for user ${userId}`);
      }

      // Fetch journal posts for additional context
      const journalPosts = await this.prisma.journalPost.findMany({
        where: { 
          userId,
          includeInAI: true, // Only include posts marked for AI
          deletedAt: null, // Exclude soft-deleted posts
        },
        orderBy: { publishedAt: 'desc' },
        take: 20, // Get last 20 posts
        select: {
          text: true,
          publishedAt: true,
        },
      });

      // Call LLM service to analyze fit
      this.logger.log(`Calling LLM service to analyze position fit for interview ${interviewId}`);
      
      const response = await axios.post(
        `${this.llmServiceUrl}/api/positions/score`,
        {
          company,
          position,
          jobUrl,
          jobDescription,
          resume: {
            content: resume.content,
            llmContext: resume.llmContext,
          },
          journalEntries: journalPosts.map(post => ({
            title: '', // JournalPost doesn't have title
            content: post.text,
            tags: [], // JournalPost doesn't have tags
            date: post.publishedAt.toISOString(),
          })),
        },
        {
          timeout: 180000, // 3 minute timeout
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const scoringData = response.data;

      this.logger.log(`Position fit analysis complete for interview ${interviewId}: Score ${scoringData.fitScore}/10`);

      // Update interview with fit score
      await this.prisma.interviewProcess.update({
        where: { id: interviewId },
        data: {
          fitScore: scoringData.fitScore,
          fitAnalysis: scoringData.analysis ? JSON.stringify(scoringData.analysis) : null,
        } as any, // Type assertion needed until Prisma client regenerates in IDE
      });

      this.logger.log(`Updated interview ${interviewId} with fit score`);

      return {
        success: true,
        interviewId,
        fitScore: scoringData.fitScore,
        analysis: scoringData.analysis,
      };
    } catch (error) {
      this.logger.error(`Error processing scoring job for interview ${interviewId}: ${error.message}`);
      
      // Don't fail permanently to allow manual retry
      return {
        success: false,
        interviewId,
        error: error.message,
      };
    }
  }
}
