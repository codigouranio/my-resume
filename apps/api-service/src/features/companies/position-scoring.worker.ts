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
import { createRedisConfig } from '@shared/redis/redis.config';
import axios from 'axios';

/**
 * Worker service that processes position scoring jobs from BullMQ
 */
@Injectable()
export class PositionScoringWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PositionScoringWorkerService.name);
  private worker: Worker<PositionScoringJob, PositionScoringResult>;
  private llmServiceUrl: string;
  private llmApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.llmServiceUrl = this.configService.get('LLM_SERVICE_URL', 'http://localhost:5000');
    this.llmApiKey = this.configService.get('LLM_API_KEY', '');
    
    if (!this.llmApiKey) {
      this.logger.warn('LLM_API_KEY not configured - LLM service calls may fail');
    }
  }

  /**
   * Get headers for LLM service requests.
   */
  private getLLMHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.llmApiKey,
    };
  }

  onModuleInit() {
    const redisConfig = createRedisConfig(this.configService);

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
      // Fetch interview to get the selected resume
      const interview = await this.prisma.interviewProcess.findUnique({
        where: { id: interviewId },
        select: {
          resumeId: true,
          resume: {
            select: {
              id: true,
              content: true,
              llmContext: true,
            },
          },
          user: {
            select: {
              id: true,
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
          },
        },
      });

      if (!interview) {
        throw new Error(`Interview ${interviewId} not found`);
      }

      const user = interview.user;
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Use interview's selected resume, or fall back to user's default resume
      const resume = interview.resume || user.defaultResume;
      if (!resume) {
        throw new Error(`No resume found for interview ${interviewId} (neither selected nor default)`);
      }

      this.logger.log(
        `Using resume ${resume.id} for interview ${interviewId} ${interview.resumeId ? '(selected)' : '(default)'}`,
      );

      // Fetch journal posts for additional context
      const journalPosts = await this.prisma.journalPost.findMany({
        where: { 
          userId: user.id,
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
      
      const useWebhooks = this.configService.get('USE_LLM_WEBHOOKS', 'true') === 'true';
      const callbackUrl = `${this.configService.get('API_BASE_URL', 'http://localhost:3000')}/api/webhooks/llm-result`;
      
      const requestBody = {
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
        ...(useWebhooks ? {
          callbackUrl,
          metadata: {
            userId,
            interviewId,
            jobId: job.id,
          },
        } : {}),
      };
      
      const response = await axios.post(
        `${this.llmServiceUrl}/api/positions/score`,
        requestBody,
        {
          timeout: useWebhooks ? 10000 : 180000, // 10s for webhook, 3min for sync
          headers: this.getLLMHeaders(),
        },
      );

      if (useWebhooks) {
        // Webhook mode - job completes immediately
        this.logger.log(`Position scoring queued for interview ${interviewId}. Awaiting webhook callback.`);
        
        return {
          success: true,
          interviewId,
          message: 'Position scoring queued, awaiting webhook callback',
          llmJobId: response.data.jobId,
        };
      }

      // Sync mode - process result immediately
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
