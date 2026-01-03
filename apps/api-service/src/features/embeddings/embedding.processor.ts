import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '@shared/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { EmbeddingJobData } from './embedding-queue.service';

interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  model: string;
}

@Injectable()
@Processor('embeddings')
export class EmbeddingProcessor {
  private readonly logger = new Logger(EmbeddingProcessor.name);
  private readonly llmServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.llmServiceUrl = this.configService.get<string>('LLM_SERVICE_URL', 'http://localhost:5000');
  }

  @OnQueueActive()
  onActive(job: Job<EmbeddingJobData>) {
    this.logger.log(`Processing embedding job ${job.id} for resume ${job.data.resumeId}`);
  }

  @OnQueueCompleted()
  onComplete(job: Job<EmbeddingJobData>, result: any) {
    this.logger.log(`Completed embedding job ${job.id} for resume ${job.data.resumeId}`);
  }

  @OnQueueFailed()
  onError(job: Job<EmbeddingJobData>, error: Error) {
    this.logger.error(
      `Failed embedding job ${job.id} for resume ${job.data.resumeId}: ${error.message}`,
      error.stack,
    );
  }

  @Process('generate')
  async handleEmbeddingGeneration(job: Job<EmbeddingJobData>) {
    const { resumeId, type } = job.data;

    try {
      // Step 1: Fetch resume from database
      this.logger.debug(`Fetching resume ${resumeId}`);
      const resume = await this.prisma.resume.findUnique({
        where: { id: resumeId },
        select: {
          id: true,
          content: true,
          llmContext: true,
        },
      });

      if (!resume) {
        throw new Error(`Resume ${resumeId} not found`);
      }

      job.progress(20); // 20% - Resume fetched

      // Step 2: Generate embeddings
      this.logger.debug(`Generating embeddings for resume ${resumeId}`);
      
      const [contentEmbeddingData, llmContextEmbeddingData] = await Promise.all([
        this.generateEmbedding(resume.content || ''),
        resume.llmContext ? this.generateEmbedding(resume.llmContext) : null,
      ]);

      job.progress(60); // 60% - Embeddings generated

      // Step 3: Calculate combined embedding (weighted average)
      // 70% content + 30% llmContext
      const combinedEmbedding = this.calculateCombinedEmbedding(
        contentEmbeddingData.embedding,
        llmContextEmbeddingData?.embedding,
      );

      job.progress(70); // 70% - Combined embedding calculated

      // Step 4: Calculate MD5 hashes for change detection
      const contentHash = this.calculateHash(resume.content || '');
      const llmContextHash = resume.llmContext ? this.calculateHash(resume.llmContext) : null;

      job.progress(80); // 80% - Hashes calculated

      // Step 5: Upsert embeddings to database
      // Use raw SQL because Prisma doesn't support vector types in TypeScript yet
      this.logger.debug(`Storing embeddings for resume ${resumeId}`);
      
      const contentEmbeddingStr = `[${contentEmbeddingData.embedding.join(',')}]`;
      const llmContextEmbeddingStr = llmContextEmbeddingData
        ? `[${llmContextEmbeddingData.embedding.join(',')}]`
        : null;
      const combinedEmbeddingStr = `[${combinedEmbedding.join(',')}]`;

      // Check if embedding exists
      const existing = await this.prisma.resumeEmbedding.findUnique({
        where: { resumeId },
      });

      if (existing) {
        // Update using raw SQL
        await this.prisma.$executeRaw`
          UPDATE "ResumeEmbedding"
          SET 
            "contentEmbedding" = ${contentEmbeddingStr}::vector(768),
            "llmContextEmbedding" = ${llmContextEmbeddingStr}::vector(768),
            "combinedEmbedding" = ${combinedEmbeddingStr}::vector(768),
            "embeddingModel" = ${contentEmbeddingData.model},
            "contentHash" = ${contentHash},
            "llmContextHash" = ${llmContextHash},
            "updatedAt" = NOW()
          WHERE "resumeId" = ${resumeId}
        `;
      } else {
        // Insert using raw SQL
        await this.prisma.$executeRaw`
          INSERT INTO "ResumeEmbedding" (
            id, "resumeId", "contentEmbedding", "llmContextEmbedding", 
            "combinedEmbedding", "embeddingModel", "contentHash", 
            "llmContextHash", "createdAt", "updatedAt"
          )
          VALUES (
            gen_random_uuid(), ${resumeId}, 
            ${contentEmbeddingStr}::vector(768),
            ${llmContextEmbeddingStr}::vector(768),
            ${combinedEmbeddingStr}::vector(768),
            ${contentEmbeddingData.model}, ${contentHash}, ${llmContextHash},
            NOW(), NOW()
          )
        `;
      }

      job.progress(100); // 100% - Complete

      this.logger.log(
        `Successfully generated embeddings for resume ${resumeId} (type: ${type}, dimensions: ${contentEmbeddingData.dimensions})`,
      );

      return {
        resumeId,
        type,
        dimensions: contentEmbeddingData.dimensions,
        model: contentEmbeddingData.model,
        hasLlmContext: !!llmContextEmbeddingData,
      };
    } catch (error) {
      this.logger.error(`Error generating embeddings for resume ${resumeId}:`, error);
      throw error; // Re-throw to trigger Bull retry mechanism
    }
  }

  /**
   * Truncate text to fit within nomic-embed-text context window
   * Max ~8000 tokens ≈ 6000 chars (rough estimate: 1.3 chars/token)
   */
  private truncateText(text: string, maxChars: number = 6000): string {
    if (text.length <= maxChars) {
      return text;
    }
    this.logger.warn(`Truncating text from ${text.length} to ${maxChars} chars`);
    return text.substring(0, maxChars);
  }

  /**
   * Generate embedding for a text via LLM service
   */
  private async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    try {
      // Truncate text to fit in model context window
      const truncatedText = this.truncateText(text);
      
      const response = await axios.post<EmbeddingResponse>(
        `${this.llmServiceUrl}/api/embed`,
        {
          text: truncatedText,
          model: 'nomic-embed-text',
        },
        {
          timeout: 30000, // 30 second timeout
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `LLM service error: ${error.response?.data?.error || error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Calculate combined embedding with weighted average
   * Default: 70% content + 30% llmContext
   */
  private calculateCombinedEmbedding(
    contentEmbedding: number[],
    llmContextEmbedding?: number[],
    contentWeight: number = 0.7,
  ): number[] {
    if (!llmContextEmbedding) {
      // If no llmContext, use content embedding only
      return contentEmbedding;
    }

    const llmContextWeight = 1 - contentWeight;
    return contentEmbedding.map((val, idx) => 
      val * contentWeight + llmContextEmbedding[idx] * llmContextWeight
    );
  }

  /**
   * Calculate MD5 hash of text for change detection
   */
  private calculateHash(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }
}
