import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/database/prisma.service';
import axios from 'axios';
import { SearchResumesDto, SearchResultItem, SearchResumesResponse } from './dto/search-resumes.dto';

interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  model: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly llmServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.llmServiceUrl = this.configService.get<string>('LLM_SERVICE_URL', 'http://localhost:5000');
  }

  async searchResumes(
    searchDto: SearchResumesDto,
    authenticatedUserId?: string,
  ): Promise<SearchResumesResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Generate embedding for search query
      this.logger.debug(`Generating embedding for query: "${searchDto.query}"`);
      const queryEmbedding = await this.generateEmbedding(searchDto.query);

      // Step 2: Build SQL query with filters
      const queryEmbeddingStr = `[${queryEmbedding.embedding.join(',')}]`;
      const minSimilarity = searchDto.minSimilarity ?? 0.4; // Default to 0.4 (40% similarity) - adjusted for truncated content
      const limit = searchDto.limit ?? 10;
      const offset = searchDto.offset ?? 0;

      // Build WHERE clause for filters
      const filters: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Always require embeddings exist
      filters.push(`re."combinedEmbedding" IS NOT NULL`);

      // Public only filter
      if (searchDto.publicOnly !== false) {
        filters.push(`r."isPublic" = true AND r."isPublished" = true`);
      }

      // User filter (admin or owner can filter by userId)
      if (searchDto.userId) {
        if (authenticatedUserId && (authenticatedUserId === searchDto.userId || this.isAdmin(authenticatedUserId))) {
          filters.push(`r."userId" = $${paramIndex}`);
          params.push(searchDto.userId);
          paramIndex++;
        }
      }

      const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

      // Step 3: Execute similarity search with pgvector
      // Note: Using raw SQL because Prisma doesn't support vector operations
      // Cosine distance: 0 = identical, 2 = opposite. We convert to similarity: 1 - distance/2
      const sql = `
        WITH ranked_results AS (
          SELECT 
            r.id,
            r.slug,
            r.title,
            r.content,
            r."userId",
            u."firstName",
            u."lastName",
            (1 - (re."combinedEmbedding" <=> $${paramIndex}::vector(768))) AS similarity
          FROM "Resume" r
          INNER JOIN "ResumeEmbedding" re ON re."resumeId" = r.id
          LEFT JOIN "User" u ON u.id = r."userId"
          ${whereClause}
          ORDER BY re."combinedEmbedding" <=> $${paramIndex}::vector(768)
          LIMIT $${paramIndex + 1}
          OFFSET $${paramIndex + 2}
        )
        SELECT * FROM ranked_results
        WHERE similarity >= $${paramIndex + 3}
        ORDER BY similarity DESC
      `;

      params.push(queryEmbeddingStr, limit, offset, minSimilarity);

      this.logger.debug(`Executing search with ${filters.length} filters, limit=${limit}, offset=${offset}`);
      
      const results = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);

      // Step 4: Transform results
      const searchResults: SearchResultItem[] = results.map((row, index) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        content: this.truncateContent(row.content, 500), // Truncate for preview
        userId: row.userId,
        user: row.firstName && row.lastName ? {
          firstName: row.firstName,
          lastName: row.lastName,
        } : undefined,
        similarity: parseFloat(row.similarity.toFixed(4)),
        rank: offset + index + 1,
      }));

      // Step 5: Get total count (for pagination)
      // This is an approximation based on results length
      // For exact count, would need separate COUNT query
      const total = searchResults.length < limit ? offset + searchResults.length : offset + limit + 1;

      const executionTime = Date.now() - startTime;

      this.logger.log(
        `Search completed: "${searchDto.query}" → ${searchResults.length} results in ${executionTime}ms`,
      );

      return {
        query: searchDto.query,
        results: searchResults,
        total,
        limit,
        offset,
        executionTime,
      };
    } catch (error) {
      this.logger.error(`Search failed for query "${searchDto.query}":`, error);
      throw error;
    }
  }

  /**
   * Generate embedding for search query via LLM service
   */
  private async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    try {
      const response = await axios.post<EmbeddingResponse>(
        `${this.llmServiceUrl}/api/embed`,
        {
          text,
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
   * Truncate content for preview
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  /**
   * Check if user is admin (placeholder - implement actual logic)
   */
  private isAdmin(userId: string): boolean {
    // TODO: Implement actual admin check (e.g., check role in database)
    return false;
  }
}
