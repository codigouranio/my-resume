import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/database/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);
  private readonly llmServiceUrl: string;
  private readonly llmApiKey: string;
  private readonly cacheValidityDays = 30; // Cache company data for 30 days

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.llmServiceUrl =
      this.configService.get<string>('LLM_SERVICE_URL') ||
      'http://localhost:5000';
    this.llmApiKey = this.configService.get<string>('LLM_API_KEY') || '';
    
    if (!this.llmApiKey) {
      this.logger.warn('LLM_API_KEY not configured - LLM service calls may fail');
    }
  }

  /**
   * Get headers for LLM service requests.
   * Includes API key authentication.
   */
  private getLLMHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.llmApiKey,
    };
  }

  /**
   * Enrich company information using LLM research agent.
   * Checks cache first, fetches from LLM service if needed.
   */
  async enrichCompany(companyName: string) {
    this.logger.log(`[enrichCompany] START: ${companyName}`);

    // Check if we have cached data (case-insensitive)
    this.logger.log(`[enrichCompany] Checking cache for: ${companyName}`);
    const cached = await this.prisma.companyInfo.findFirst({
      where: {
        companyName: {
          equals: companyName,
          mode: 'insensitive',
        },
      },
    });

    if (cached) {
      const cacheAge = Date.now() - cached.updatedAt.getTime();
      const cacheAgeDays = Math.floor(cacheAge / (1000 * 60 * 60 * 24));
      this.logger.log(`[enrichCompany] Found cached data (${cacheAgeDays} days old) for: ${cached.companyName}`);
      
      if (this.isCacheValid(cached.updatedAt)) {
        this.logger.log(`[enrichCompany] Cache is valid, returning cached data`);
        return cached;
      } else {
        this.logger.log(`[enrichCompany] Cache expired (>${this.cacheValidityDays} days), fetching fresh data`);
      }
    } else {
      this.logger.log(`[enrichCompany] No cached data found, fetching from LLM service`);
    }

    // Fetch fresh data from LLM service
    this.logger.log(`[enrichCompany] Calling LLM service for: ${companyName}`);
    const enrichedData = await this.fetchFromLLMService(companyName);
    this.logger.log(`[enrichCompany] LLM service returned data with ${Object.keys(enrichedData).length} fields`);

    // Use official name from LLM, fallback to user input if not provided
    const officialName = enrichedData.companyName || companyName;

    // Save or update in database with official name
    const companyInfo = await this.prisma.companyInfo.upsert({
      where: { companyName: officialName },
      create: {
        ...enrichedData,
        companyName: officialName, // Ensure official name is used
      },
      update: enrichedData,
    });

    this.logger.log(`Company enrichment complete: ${companyName} → ${officialName}`);
    return companyInfo;
  }

  /**
   * Get company info by name (from cache only).
   */
  async getCompanyInfo(companyName: string) {
    return this.prisma.companyInfo.findUnique({
      where: { companyName },
    });
  }

  /**
   * Get all cached company info.
   */
  async getAllCompanies() {
    return this.prisma.companyInfo.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Manually update company info.
   */
  async updateCompanyInfo(companyName: string, data: Partial<any>) {
    return this.prisma.companyInfo.update({
      where: { companyName },
      data: {
        ...data,
        source: 'manual_update',
      },
    });
  }

  /**
   * Delete company info from cache.
   */
  async deleteCompanyInfo(companyName: string) {
    return this.prisma.companyInfo.delete({
      where: { companyName },
    });
  }

  /**
   * Link enriched company info to existing interviews with matching company name.
   * Called after successful enrichment to auto-link interviews.
   */
  async linkToInterviews(companyName: string): Promise<number> {
    try {
      // Find the company info (case-insensitive to handle user input variations)
      const companyInfo = await this.prisma.companyInfo.findFirst({
        where: {
          companyName: {
            equals: companyName,
            mode: 'insensitive',
          },
        },
      });

      if (!companyInfo) {
        this.logger.warn(`Company info not found for: ${companyName}`);
        return 0;
      }

      // Find all interviews with matching company name (case-insensitive) that aren't linked yet
      const result = await this.prisma.interviewProcess.updateMany({
        where: {
          company: {
            equals: companyName,
            mode: 'insensitive',
          },
          companyInfoId: null, // Only link if not already linked
        },
        data: {
          companyInfoId: companyInfo.id,
          // Don't change company name - keep user input as-is
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Linked company info for ${companyName} to ${result.count} interview(s)`,
        );
      }

      return result.count;
    } catch (error) {
      this.logger.error(
        `Failed to link company info to interviews: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  /**
   * Normalize all interview company names to match official enriched company names.
   * This updates interviews that are already linked but have non-normalized names.
   */
  async normalizeAllCompanyNames(): Promise<{ updated: number; companies: string[] }> {
    try {
      const companies = await this.prisma.companyInfo.findMany({
        select: { id: true, companyName: true, legalName: true },
      });

      let totalUpdated = 0;
      const updatedCompanies: string[] = [];

      for (const company of companies) {
        const officialName = company.legalName || company.companyName;
        // Find interviews linked to this company but with different name (case-insensitive)
        const interviews = await this.prisma.interviewProcess.findMany({
          where: {
            companyInfoId: company.id,
            NOT: {
              company: officialName, // Exact match (case-sensitive)
            },
          },
        });

        if (interviews.length > 0) {
          // Update all these interviews to use the official name (legal name when available)
          const result = await this.prisma.interviewProcess.updateMany({
            where: {
              id: { in: interviews.map(i => i.id) },
            },
            data: {
              company: officialName,
            },
          });

          totalUpdated += result.count;
          updatedCompanies.push(officialName);
          this.logger.log(
            `Normalized ${result.count} interview(s) to official name: ${officialName}`,
          );
        }
      }

      return { updated: totalUpdated, companies: updatedCompanies };
    } catch (error) {
      this.logger.error(
        `Failed to normalize company names: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check if cached data is still valid.
   */
  private isCacheValid(lastUpdated: Date): boolean {
    const daysSinceUpdate =
      (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate < this.cacheValidityDays;
  }

  /**
   * Fetch company data from LLM service (async webhook mode).
   * Fire and forget - LLM will call webhook when complete.
   */
  async enrichCompanyAsync(companyName: string, userId: string, jobId: string): Promise<{ jobId: string }> {
    const callbackUrl = `${this.configService.get('API_BASE_URL', 'http://localhost:3000')}/api/webhooks/llm-result`;
    
    this.logger.log(`Queueing async enrichment for: ${companyName} (webhook: ${callbackUrl})`);

    try {
      const response = await fetch(`${this.llmServiceUrl}/api/companies/enrich`, {
        method: 'POST',
        headers: this.getLLMHeaders(),
        body: JSON.stringify({
          companyName,
          callbackUrl,
          metadata: {
            userId,
            jobId,
            companyName,
          },
        }),
        signal: AbortSignal.timeout(10000), // 10 second timeout just for queueing
      });

      if (!response.ok) {
        throw new Error(
          `LLM service returned ${response.status}: ${response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`LLM service accepted job for ${companyName}: ${result.jobId || jobId}`);
      
      return { jobId: result.jobId || jobId };
    } catch (error) {
      this.logger.error(
        `Failed to queue LLM enrichment for ${companyName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Fetch company data from LLM service research agent (sync mode - DEPRECATED).
   * This is the old synchronous method - use enrichCompanyAsync instead.
   */
  private async fetchFromLLMService(companyName: string): Promise<any> {
    this.logger.log(`Calling LLM service at ${this.llmServiceUrl}/api/companies/enrich for: ${companyName}`);
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${this.llmServiceUrl}/api/companies/enrich`, {
        method: 'POST',
        headers: this.getLLMHeaders(),
        body: JSON.stringify({ companyName }),
        signal: AbortSignal.timeout(120000), // 120 second timeout for sync (increased from 60s)
      });

      const duration = Date.now() - startTime;
      this.logger.log(`LLM service responded in ${duration}ms with status ${response.status}`);

      if (!response.ok) {
        throw new Error(
          `LLM service returned ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();
      this.logger.log(`[fetchFromLLMService] LLM response data keys: ${Object.keys(data).join(', ')}`);
      
      // Handle both sync and async response formats
      if (data.company_data) {
        this.logger.log(`[fetchFromLLMService] Sync response: company_data present`);
        return data.company_data;
      } else if (data.companyData) {
        this.logger.log(`[fetchFromLLMService] Sync response: companyData present`);
        return data.companyData;
      } else {
        this.logger.log(`[fetchFromLLMService] Direct response format`);
        return data;
      }
    } catch (error) {
      this.logger.error(
        `[fetchFromLLMService] FAILED for ${companyName}: ${error.message}`,
        error.stack,
      );
      this.logger.error(`[fetchFromLLMService] Error name: ${error.name}, code: ${error.code}`);
      throw error;
    }
  }
}
