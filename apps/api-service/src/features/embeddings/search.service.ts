import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/database/prisma.service';
import axios from 'axios';
import { SearchResumesDto, SearchResultItem, SearchResumesResponse } from './dto/search-resumes.dto';
import { UnifiedSearchDto, UnifiedSearchResultItem, UnifiedSearchResponse } from './dto/unified-search.dto';

interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  model: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly llmServiceUrl: string;
  private readonly llmApiKey: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.llmServiceUrl = this.configService.get<string>('LLM_SERVICE_URL', 'http://localhost:5000');
    this.llmApiKey = this.configService.get<string>('LLM_API_KEY', '');
    
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

      this.logger.debug(`Executing search with ${filters.length} filters, limit=${limit}, offset=${offset}, minSimilarity=${minSimilarity}`);
      this.logger.debug(`SQL params: embedding dims=${queryEmbedding.dimensions}, limit=${limit}, offset=${offset}, threshold=${minSimilarity}`);
      
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
   * Unified search across resumes and journal posts
   */
  async unifiedSearch(
    searchDto: UnifiedSearchDto,
    authenticatedUserId?: string,
  ): Promise<UnifiedSearchResponse> {
    const startTime = Date.now();

    try {
      // Generate embedding for search query
      this.logger.debug(`Unified search - Generating embedding for query: "${searchDto.query}"`);
      const queryEmbedding = await this.generateEmbedding(searchDto.query);

      const queryEmbeddingStr = `[${queryEmbedding.embedding.join(',')}]`;
      const minSimilarity = searchDto.minSimilarity ?? 0.4;
      const limit = searchDto.limit ?? 20;
      const offset = searchDto.offset ?? 0;
      const searchType = searchDto.type ?? 'all';

      let allResults: UnifiedSearchResultItem[] = [];
      let resumeCount = 0;
      let journalCount = 0;

      // Search resumes if requested
      if (searchType === 'all' || searchType === 'resumes') {
        const resumeResults = await this.searchResumesInternal(
          queryEmbeddingStr,
          minSimilarity,
          limit,
          offset,
          searchDto.publicOnly,
          searchDto.userId,
          authenticatedUserId,
        );
        resumeCount = resumeResults.length;
        allResults.push(...resumeResults);
      }

      // Search journal posts if requested
      if (searchType === 'all' || searchType === 'journals') {
        const journalResults = await this.searchJournalPostsInternal(
          queryEmbeddingStr,
          minSimilarity,
          limit,
          offset,
          searchDto.publicOnly,
          searchDto.userId,
          authenticatedUserId,
          searchDto.query,
        );
        journalCount = journalResults.length;
        allResults.push(...journalResults);
      }

      // Sort by similarity and apply limit/offset if searching both
      if (searchType === 'all') {
        allResults.sort((a, b) => b.similarity - a.similarity);
        allResults = allResults.slice(offset, offset + limit);
      }

      // Re-rank results
      allResults = allResults.map((result, index) => ({
        ...result,
        rank: offset + index + 1,
      }));

      const executionTime = Date.now() - startTime;
      const total = allResults.length;

      this.logger.log(
        `Unified search completed: "${searchDto.query}" → ${total} results (${resumeCount} resumes, ${journalCount} journals) in ${executionTime}ms`,
      );

      return {
        query: searchDto.query,
        results: allResults,
        total,
        resumeCount,
        journalCount,
        limit,
        offset,
        executionTime,
      };
    } catch (error) {
      this.logger.error(`Unified search failed for query "${searchDto.query}":`, error);
      throw error;
    }
  }

  /**
   * Internal method to search resumes
   */
  private async searchResumesInternal(
    queryEmbeddingStr: string,
    minSimilarity: number,
    limit: number,
    offset: number,
    publicOnly?: boolean,
    userId?: string,
    authenticatedUserId?: string,
  ): Promise<UnifiedSearchResultItem[]> {
    const filters: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    filters.push(`re."combinedEmbedding" IS NOT NULL`);

    if (publicOnly !== false) {
      filters.push(`r."isPublic" = true AND r."isPublished" = true`);
    }

    if (userId && authenticatedUserId && (authenticatedUserId === userId || this.isAdmin(authenticatedUserId))) {
      filters.push(`r."userId" = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

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

    const results = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);

    return results.map((row) => ({
      id: row.id,
      type: 'resume' as const,
      slug: row.slug,
      title: row.title,
      content: this.truncateContent(row.content, 500),
      userId: row.userId,
      user: row.firstName && row.lastName ? {
        firstName: row.firstName,
        lastName: row.lastName,
      } : undefined,
      similarity: parseFloat(row.similarity.toFixed(4)),
      rank: 0, // Will be re-ranked later
    }));
  }

  /**
   * Internal method to search journal posts
   */
  private async searchJournalPostsInternal(
    queryEmbeddingStr: string,
    minSimilarity: number,
    limit: number,
    offset: number,
    publicOnly?: boolean,
    userId?: string,
    authenticatedUserId?: string,
    searchQuery?: string,
  ): Promise<UnifiedSearchResultItem[]> {
    const filters: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Only search public journal posts for now (we don't have embeddings for them yet)
    // This is a simple text search using PostgreSQL's trigram similarity
    filters.push(`jp."deletedAt" IS NULL`);

    if (publicOnly !== false) {
      filters.push(`jp."isPublic" = true`);
    }

    if (userId && authenticatedUserId && (authenticatedUserId === userId || this.isAdmin(authenticatedUserId))) {
      filters.push(`jp."userId" = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // Use PostgreSQL's full-text search as a fallback for journal posts
    // In the future, you could add embeddings for journal posts too
    const sql = `
      SELECT 
        jp.id,
        jp.text,
        jp."userId",
        jp."publishedAt",
        u."firstName",
        u."lastName",
        0.5 AS similarity
      FROM "JournalPost" jp
      LEFT JOIN "User" u ON u.id = jp."userId"
      ${whereClause}
      AND jp.text ILIKE $${paramIndex}
      ORDER BY jp."publishedAt" DESC
      LIMIT $${paramIndex + 1}
      OFFSET $${paramIndex + 2}
    `;

    // Extract keywords from query for simple text matching
    const searchPattern = `%${searchQuery ?? ''}%`;
    params.push(searchPattern, limit, offset);

    try {
      const results = await this.prisma.$queryRawUnsafe<any[]>(sql, ...params);

      return results.map((row) => ({
        id: row.id,
        type: 'journal' as const,
        text: row.text,
        content: this.truncateContent(row.text, 500),
        userId: row.userId,
        user: row.firstName && row.lastName ? {
          firstName: row.firstName,
          lastName: row.lastName,
        } : undefined,
        publishedAt: row.publishedAt?.toISOString(),
        similarity: parseFloat(row.similarity),
        rank: 0, // Will be re-ranked later
      }));
    } catch (error) {
      this.logger.error('Failed to search journal posts:', error);
      return [];
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
          headers: this.getLLMHeaders(),
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
