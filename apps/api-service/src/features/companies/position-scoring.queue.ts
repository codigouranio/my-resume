import { Queue, Worker, Job } from 'bullmq';
import { Logger } from '@nestjs/common';

const logger = new Logger('PositionScoringQueue');

export interface PositionScoringJob {
  interviewId: string;
  userId: string;
  company: string;
  position: string;
  jobUrl?: string;
  jobDescription?: string;
}

export interface PositionScoringResult {
  success: boolean;
  interviewId: string;
  fitScore?: number; // 1-10
  analysis?: {
    strengths: string[];
    gaps: string[];
    recommendations: string[];
    summary: string;
  };
  error?: string;
  message?: string; // For webhook mode status messages
  llmJobId?: string; // Job ID from LLM service (webhook mode)
}

// Queue instance
let positionScoringQueue: Queue<PositionScoringJob>;

/**
 * Initialize the position scoring queue
 */
export function createPositionScoringQueue(redisConfig: any): Queue<PositionScoringJob> {
  if (positionScoringQueue) {
    return positionScoringQueue;
  }

  positionScoringQueue = new Queue('position-scoring', {
    connection: {
      host: redisConfig.host || 'localhost',
      port: redisConfig.port || 6379,
      password: redisConfig.password,
      db: redisConfig.db || 0,
      tls: redisConfig.tls,
    },
    defaultJobOptions: {
      attempts: 2, // Less retries since this is compute-intensive
      backoff: {
        type: 'exponential',
        delay: 10000, // Wait 10s before retry
      },
      removeOnComplete: {
        age: 7 * 24 * 3600, // Keep completed jobs for 7 days
        count: 200,
      },
      removeOnFail: {
        age: 30 * 24 * 3600, // Keep failed jobs for 30 days
      },
    },
  }) as Queue<PositionScoringJob>;

  logger.log('Position scoring queue initialized');
  return positionScoringQueue;
}

/**
 * Get the queue instance
 */
export function getPositionScoringQueue(): Queue<PositionScoringJob> {
  if (!positionScoringQueue) {
    throw new Error('Position scoring queue not initialized. Call createPositionScoringQueue first.');
  }
  return positionScoringQueue;
}

/**
 * Add a position scoring job to the queue
 */
export async function enqueuePositionScoring(
  data: PositionScoringJob
): Promise<Job<PositionScoringJob>> {
  const queue = getPositionScoringQueue();
  
  // Check if a job for this interview is already queued or processing
  const existingJobs = await queue.getJobs(['waiting', 'active']);
  const duplicate = existingJobs.find(job => job.data.interviewId === data.interviewId);
  
  if (duplicate) {
    logger.log(`Scoring job for interview ${data.interviewId} already exists (${duplicate.id}), skipping`);
    return duplicate;
  }

  const job = await queue.add('score-position', data, {
    jobId: `score-${data.interviewId}-${Date.now()}`,
  });

  logger.log(`Queued position scoring job for: ${data.position} at ${data.company} (Job ID: ${job.id})`);
  return job;
}

/**
 * Create and start the worker that processes scoring jobs
 */
export function createPositionScoringWorker(
  redisConfig: any,
  processor: (job: Job<PositionScoringJob>) => Promise<PositionScoringResult>
): Worker<PositionScoringJob, PositionScoringResult> {
  const worker = new Worker<PositionScoringJob, PositionScoringResult>(
    'position-scoring',
    processor,
    {
      connection: {
        host: redisConfig.host || 'localhost',
        port: redisConfig.port || 6379,
        password: redisConfig.password,
        db: redisConfig.db || 0,
        tls: redisConfig.tls,
        maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
        enableReadyCheck: redisConfig.enableReadyCheck !== undefined ? redisConfig.enableReadyCheck : true,
        connectTimeout: redisConfig.connectTimeout || 10000,
      },
      concurrency: 1, // Process 1 job at a time (LLM intensive)
    }
  );

  worker.on('completed', (job) => {
    logger.log(`Job ${job.id} completed for interview ${job.data.interviewId}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed for interview ${job?.data.interviewId}: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`Worker error: ${err.message}`);
  });

  logger.log('Position scoring worker started');
  return worker;
}
