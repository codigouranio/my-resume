import { Queue, Worker, Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('CompanyEnrichmentQueue');

export interface CompanyEnrichmentJob {
  companyName: string;
  userId: string;
  interviewId?: string;
}

export interface CompanyEnrichmentResult {
  success: boolean;
  companyName: string;
  data?: any;
  error?: string;
  message?: string;  // Status message for webhook mode
  llmJobId?: string; // LLM service job ID for tracking
}

// Queue instance
let companyEnrichmentQueue: Queue<CompanyEnrichmentJob>;

/**
 * Initialize the company enrichment queue
 */
export function createCompanyEnrichmentQueue(redisConfig: any): Queue<CompanyEnrichmentJob> {
  if (companyEnrichmentQueue) {
    return companyEnrichmentQueue;
  }

  companyEnrichmentQueue = new Queue<CompanyEnrichmentJob>('company-enrichment', {
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
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 100,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  });

  logger.log('Company enrichment queue initialized');
  return companyEnrichmentQueue;
}

/**
 * Get the queue instance
 */
export function getCompanyEnrichmentQueue(): Queue<CompanyEnrichmentJob> {
  if (!companyEnrichmentQueue) {
    throw new Error('Company enrichment queue not initialized. Call createCompanyEnrichmentQueue first.');
  }
  return companyEnrichmentQueue;
}

/**
 * Add a company enrichment job to the queue
 */
export async function enqueueCompanyEnrichment(
  data: CompanyEnrichmentJob
): Promise<Job<CompanyEnrichmentJob>> {
  const queue = getCompanyEnrichmentQueue();
  
  // Check if a job for this company is already queued or processing
  const existingJobs = await queue.getJobs(['waiting', 'active']);
  const duplicate = existingJobs.find(job => job.data.companyName === data.companyName);
  
  if (duplicate) {
    logger.log(`Job for ${data.companyName} already exists (${duplicate.id}), skipping`);
    return duplicate;
  }

  const job = await queue.add('enrich-company', data, {
    jobId: `enrich-${data.companyName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
  });

  logger.log(`Queued company enrichment job for: ${data.companyName} (Job ID: ${job.id})`);
  return job;
}

/**
 * Create and start the worker that processes enrichment jobs
 */
export function createCompanyEnrichmentWorker(
  redisConfig: any,
  processor: (job: Job<CompanyEnrichmentJob>) => Promise<CompanyEnrichmentResult>
): Worker<CompanyEnrichmentJob, CompanyEnrichmentResult> {
  const worker = new Worker<CompanyEnrichmentJob, CompanyEnrichmentResult>(
    'company-enrichment',
    processor,
    {
      connection: {
        host: redisConfig.host || 'localhost',
        port: redisConfig.port || 6379,
        password: redisConfig.password,
      },
      concurrency: 2, // Process 2 jobs concurrently (rate limit friendly)
    }
  );

  worker.on('completed', (job) => {
    logger.log(`Job ${job.id} completed for ${job.data.companyName}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed for ${job?.data.companyName}: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`Worker error: ${err.message}`);
  });

  logger.log('Company enrichment worker started');
  return worker;
}
