import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { EnrichCompanyDto } from './dto/enrich-company.dto';
import { ScorePositionDto } from './dto/score-position.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { enqueueCompanyEnrichment, getCompanyEnrichmentQueue } from './companies.queue';
import { enqueuePositionScoring, getPositionScoringQueue } from './position-scoring.queue';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post('enrich')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enrich company information (synchronous)',
    description:
      'Automatically gathers company data from web sources using LLM-powered research. ' +
      'Results are cached for 30 days. This endpoint blocks until complete (10-30 seconds).',
  })
  async enrichCompany(@Body() dto: EnrichCompanyDto, @Req() req: any) {
    const userId = req.user?.userId || 'unknown';
    console.log(`[CompaniesController] POST /companies/enrich called by user ${userId} for company: ${dto.companyName}`);
    try {
      const result = await this.companiesService.enrichCompany(dto.companyName);
      console.log(`[CompaniesController] Enrichment successful for ${dto.companyName}, returned ${Object.keys(result).length} fields`);
      return result;
    } catch (error) {
      console.error(`[CompaniesController] Enrichment failed for ${dto.companyName}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('enrich/queue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Queue company enrichment job (async with BullMQ)',
    description:
      'Queues a background job to enrich company data. Returns immediately with job ID. ' +
      'Use GET /companies/enrich/status/:jobId to check progress.',
  })
  async queueEnrichment(@Body() dto: EnrichCompanyDto, @Req() req: any) {
    const userId = req.user?.userId || 'system';
    console.log(`[CompaniesController] POST /companies/enrich/queue called by user ${userId} for company: ${dto.companyName}`);
    
    try {
      const job = await enqueueCompanyEnrichment({
        companyName: dto.companyName,
        userId,
      });
      console.log(`[CompaniesController] Job queued successfully: ${job.id} for company ${dto.companyName}`);

      return {
        jobId: job.id,
        companyName: dto.companyName,
        status: 'queued',
        message: 'Company enrichment job queued successfully',
      };
    } catch (error) {
      console.error(`[CompaniesController] Failed to queue enrichment for ${dto.companyName}: ${error.message}`);
      throw error;
    }
  }

  @Get('enrich/status/:jobId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check enrichment job status',
    description: 'Get the status of a queued enrichment job by job ID',
  })
  async getJobStatus(@Param('jobId') jobId: string) {
    const queue = getCompanyEnrichmentQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
        message: 'Job not found',
      };
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;

    return {
      jobId: job.id,
      companyName: job.data.companyName,
      status: state,
      progress,
      result: state === 'completed' ? returnValue : null,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    };
  }

  @Get(':companyName')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get cached company information',
    description: 'Retrieve company data from cache (does not trigger research)',
  })
  async getCompanyInfo(@Param('companyName') companyName: string) {
    return this.companiesService.getCompanyInfo(companyName);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all cached companies',
    description: 'List all companies that have been enriched',
  })
  async getAllCompanies() {
    return this.companiesService.getAllCompanies();
  }

  @Post('positions/score/queue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Queue position fit scoring job (async with BullMQ)',
    description:
      'Queues a background job to analyze position fit using AI. ' +
      'Analyzes job posting, resume, journal entries, and generates a 1-10 fit score. ' +
      'Returns immediately with job ID. Use GET /companies/positions/score/status/:jobId to check progress.',
  })
  async queuePositionScoring(@Body() dto: ScorePositionDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    
    const job = await enqueuePositionScoring({
      interviewId: dto.interviewId,
      userId,
      company: dto.company,
      position: dto.position,
      jobUrl: dto.jobUrl,
      jobDescription: dto.jobDescription,
    });

    return {
      jobId: job.id,
      interviewId: dto.interviewId,
      status: 'queued',
      message: 'Position scoring job queued successfully',
    };
  }

  @Get('positions/score/status/:jobId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check position scoring job status',
    description: 'Get the status of a queued position scoring job by job ID',
  })
  async getPositionScoringStatus(@Param('jobId') jobId: string) {
    const queue = getPositionScoringQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
        message: 'Job not found',
      };
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;

    return {
      jobId: job.id,
      interviewId: job.data.interviewId,
      position: job.data.position,
      company: job.data.company,
      status: state,
      progress,
      result: state === 'completed' ? returnValue : null,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    };
  }

  @Post('link-all-interviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Re-link all interviews to company info',
    description:
      'Scans all interviews and links them to matching company info records. ' +
      'Also normalizes company names to match official enriched names. ' +
      'Use this to fix any interviews that were created before enrichment completed.',
  })
  async relinkAllInterviews() {
    const companies = await this.companiesService.getAllCompanies();
    let totalLinked = 0;

    for (const company of companies) {
      const linkedCount = await this.companiesService.linkToInterviews(company.companyName);
      totalLinked += linkedCount;
    }

    // Also normalize any already-linked interviews
    const normalizeResult = await this.companiesService.normalizeAllCompanyNames();

    return {
      message: 'Re-linking and normalization completed',
      companiesProcessed: companies.length,
      interviewsLinked: totalLinked,
      interviewsNormalized: normalizeResult.updated,
      companiesNormalized: normalizeResult.companies,
    };
  }

  @Post('normalize-company-names')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Normalize all company names',
    description:
      'Updates all interview company names to match official enriched company names. ' +
      'This only affects interviews that are already linked to company info.',
  })
  async normalizeCompanyNames() {
    const result = await this.companiesService.normalizeAllCompanyNames();
    
    return {
      message: 'Company name normalization completed',
      interviewsUpdated: result.updated,
      companies: result.companies,
    };
  }
}

