import { Queue, Worker, Job } from 'bullmq';

/**
 * Queue for receiving research results from LLM service
 */

// Result data structures
export interface CompanyResearchResult {
  originalJobId: string;
  type: 'company';
  success: boolean;
  userId: string;
  data?: {
    companyName: string;
    description?: string;
    industry?: string;
    founded?: string;
    headquarters?: string;
    website?: string;
    employeeCount?: number;
    revenue?: string;
    companySize?: string;
    fundingTotal?: string;
    lastFunding?: string;
    investors?: string;
    logoUrl?: string;
    avgSalary?: string;
    glassdoorRating?: number;
    benefits?: string;
    linkedinUrl?: string;
    twitterHandle?: string;
    githubUrl?: string;
    source?: string;
  };
  error?: string;
  timestamp: Date;
}

export interface PositionResearchResult {
  originalJobId: string;
  type: 'position';
  success: boolean;
  interviewId: string;
  data?: {
    fitScore: number;
    analysis: any;
  };
  error?: string;
  timestamp: Date;
}

export type LLMResearchResult = CompanyResearchResult | PositionResearchResult;

// Queue instance
let llmResultsQueue: Queue<LLMResearchResult>;

/**
 * Create LLM results queue (consumed by API service)
 */
export function createLLMResultsQueue(redisConfig: any): Queue<LLMResearchResult> {
  if (!llmResultsQueue) {
    llmResultsQueue = new Queue<LLMResearchResult>('llm-research-results', {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds
        },
        removeOnComplete: {
          age: 86400, // Keep for 24 hours
          count: 200, // Keep last 200 completed results
        },
        removeOnFail: {
          age: 604800, // Keep failed for 7 days
        },
      },
    });
  }
  return llmResultsQueue;
}

/**
 * Get existing LLM results queue
 */
export function getLLMResultsQueue(): Queue<LLMResearchResult> {
  if (!llmResultsQueue) {
    throw new Error('LLM results queue not initialized. Call createLLMResultsQueue first.');
  }
  return llmResultsQueue;
}

/**
 * Worker processor function type
 */
export type LLMResultsProcessor = (job: Job<LLMResearchResult>) => Promise<void>;

/**
 * Create worker to process LLM results
 */
export function createLLMResultsWorker(
  redisConfig: any,
  processor: LLMResultsProcessor,
): Worker<LLMResearchResult, void> {
  return new Worker<LLMResearchResult, void>('llm-research-results', processor, {
    connection: redisConfig,
    concurrency: 5, // Process up to 5 results concurrently
  });
}
