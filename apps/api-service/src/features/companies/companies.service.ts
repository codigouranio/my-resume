import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/database/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);
  private readonly llmServiceUrl: string;
  private readonly cacheValidityDays = 30; // Cache company data for 30 days

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.llmServiceUrl =
      this.configService.get<string>('LLM_SERVICE_URL') ||
      'http://localhost:5000';
  }

  /**
   * Enrich company information using LLM research agent.
   * Checks cache first, fetches from LLM service if needed.
   */
  async enrichCompany(companyName: string) {
    this.logger.log(`Enriching company: ${companyName}`);

    // Check if we have cached data (case-insensitive)
    const cached = await this.prisma.companyInfo.findFirst({
      where: {
        companyName: {
          equals: companyName,
          mode: 'insensitive',
        },
      },
    });

    if (cached && this.isCacheValid(cached.updatedAt)) {
      this.logger.log(`Using cached data for: ${cached.companyName}`);
      return cached;
    }

    // Fetch fresh data from LLM service
    this.logger.log(`Fetching fresh data from LLM service for: ${companyName}`);
    const enrichedData = await this.fetchFromLLMService(companyName);

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
          company: companyInfo.companyName, // Normalize to official company name
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Linked company info for ${companyName} to ${result.count} interview(s) and normalized company names`,
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
        select: { id: true, companyName: true },
      });

      let totalUpdated = 0;
      const updatedCompanies: string[] = [];

      for (const company of companies) {
        // Find interviews linked to this company but with different name (case-insensitive)
        const interviews = await this.prisma.interviewProcess.findMany({
          where: {
            companyInfoId: company.id,
            NOT: {
              company: company.companyName, // Exact match (case-sensitive)
            },
          },
        });

        if (interviews.length > 0) {
          // Update all these interviews to use the official name
          const result = await this.prisma.interviewProcess.updateMany({
            where: {
              id: { in: interviews.map(i => i.id) },
            },
            data: {
              company: company.companyName,
            },
          });

          totalUpdated += result.count;
          updatedCompanies.push(company.companyName);
          this.logger.log(
            `Normalized ${result.count} interview(s) to official name: ${company.companyName}`,
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
   * Fetch company data from LLM service research agent.
   */
  private async fetchFromLLMService(companyName: string): Promise<any> {
    try {
      const response = await fetch(`${this.llmServiceUrl}/api/companies/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyName }),
      });

      if (!response.ok) {
        throw new Error(
          `LLM service returned ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();
      
      // Keep the official company name from LLM response
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch from LLM service: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
