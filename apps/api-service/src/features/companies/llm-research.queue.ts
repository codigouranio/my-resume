import { Queue, Worker, Job } from 'bullmq';

/**
 * Queue for sending research requests to LLM service
 */

// Job data structures
export interface CompanyResearchRequest {
  companyName: string;
  userId: string;
  originalJobId: string;
  timestamp: Date;
}

export interface PositionResearchRequest {
  interviewId: string;
  userId: string;
  company: string;
  position: string;
  jobUrl?: string;
  jobDescription?: string;
  resume: {
    content: string;
    llmContext: string;
  };
  journalEntries: Array<{
    title: string;
    content: string;
    tags: string[];
    date: string;
  }>;
  originalJobId: string;
  timestamp: Date;
}

export type LLMResearchRequest = CompanyResearchRequest | PositionResearchRequest;

// Queue instances
let companyResearchQueue: Queue<CompanyResearchRequest>;
let positionResearchQueue: Queue<PositionResearchRequest>;

/**
 * Create company research queue (consumed by LLM service)
 */
export function createCompanyResearchQueue(redisConfig: any): Queue<CompanyResearchRequest> {
  if (!companyResearchQueue) {
    companyResearchQueue = new Queue<CompanyResearchRequest>('llm-company-research', {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 seconds
        },
        removeOnComplete: {
          age: 86400, // Keep for 24 hours
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    });
  }
  return companyResearchQueue;
}

/**
 * Get existing company research queue
 */
export function getCompanyResearchQueue(): Queue<CompanyResearchRequest> {
  if (!companyResearchQueue) {
    throw new Error('Company research queue not initialized. Call createCompanyResearchQueue first.');
  }
  return companyResearchQueue;
}

/**
 * Create position research queue (consumed by LLM service)
 */
export function createPositionResearchQueue(redisConfig: any): Queue<PositionResearchRequest> {
  if (!positionResearchQueue) {
    positionResearchQueue = new Queue<PositionResearchRequest>('llm-position-research', {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400,
          count: 100,
        },
        removeOnFail: {
          age: 604800,
        },
      },
    });
  }
  return positionResearchQueue;
}

/**
 * Get existing position research queue
 */
export function getPositionResearchQueue(): Queue<PositionResearchRequest> {
  if (!positionResearchQueue) {
    throw new Error('Position research queue not initialized. Call createPositionResearchQueue first.');
  }
  return positionResearchQueue;
}

/**
 * Helper to enqueue company research request
 */
export async function enqueueCompanyResearch(
  queue: Queue<CompanyResearchRequest>,
  data: Omit<CompanyResearchRequest, 'timestamp'>,
): Promise<string> {
  const job = await queue.add('company-research', {
    ...data,
    timestamp: new Date(),
  });
  return job.id as string;
}

/**
 * Helper to enqueue position research request
 */
export async function enqueuePositionResearch(
  queue: Queue<PositionResearchRequest>,
  data: Omit<PositionResearchRequest, 'timestamp'>,
): Promise<string> {
  const job = await queue.add('position-research', {
    ...data,
    timestamp: new Date(),
  });
  return job.id as string;
}
