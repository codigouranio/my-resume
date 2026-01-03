import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EmbeddingJobType } from './dto/generate-embedding.dto';

export interface EmbeddingJobData {
  resumeId: string;
  type: EmbeddingJobType;
  userId?: string;
  attemptNumber?: number;
}

@Injectable()
export class EmbeddingQueueService {
  private readonly logger = new Logger(EmbeddingQueueService.name);

  constructor(
    @InjectQueue('embeddings')
    private readonly embeddingQueue: Queue<EmbeddingJobData>,
  ) {}

  /**
   * Add a job to generate embeddings for a resume
   */
  async addEmbeddingJob(
    resumeId: string,
    type: EmbeddingJobType = EmbeddingJobType.MANUAL,
    userId?: string,
  ): Promise<string> {
    this.logger.log(`Queueing embedding job for resume ${resumeId} (type: ${type})`);

    const job = await this.embeddingQueue.add(
      'generate',
      {
        resumeId,
        type,
        userId,
        attemptNumber: 1,
      },
      {
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2s delay
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs for debugging
      },
    );

    this.logger.log(`Embedding job queued with ID: ${job.id}`);
    return job.id.toString();
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    const job = await this.embeddingQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress();
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      returnValue,
      failedReason,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.embeddingQueue.getWaitingCount(),
      this.embeddingQueue.getActiveCount(),
      this.embeddingQueue.getCompletedCount(),
      this.embeddingQueue.getFailedCount(),
      this.embeddingQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Clear all failed jobs (useful for maintenance)
   */
  async clearFailedJobs(): Promise<number> {
    const jobs = await this.embeddingQueue.getFailed();
    await Promise.all(jobs.map((job) => job.remove()));
    this.logger.log(`Cleared ${jobs.length} failed jobs`);
    return jobs.length;
  }
}
