import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { EnrichCompanyDto } from './dto/enrich-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { enqueueCompanyEnrichment, getCompanyEnrichmentQueue } from './companies.queue';

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
  async enrichCompany(@Body() dto: EnrichCompanyDto) {
    return this.companiesService.enrichCompany(dto.companyName);
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
    
    const job = await enqueueCompanyEnrichment({
      companyName: dto.companyName,
      userId,
    });

    return {
      jobId: job.id,
      companyName: dto.companyName,
      status: 'queued',
      message: 'Company enrichment job queued successfully',
    };
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
}
