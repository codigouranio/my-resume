import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EmbeddingQueueService } from './embedding-queue.service';
import { SearchService } from './search.service';
import { GenerateEmbeddingDto, EmbeddingJobType } from './dto/generate-embedding.dto';
import { SearchResumesDto, SearchResumesResponse } from './dto/search-resumes.dto';
import { PrismaService } from '@shared/database/prisma.service';

@ApiTags('embeddings')
@Controller('embeddings')
export class EmbeddingsController {
  constructor(
    private readonly embeddingQueueService: EmbeddingQueueService,
    private readonly searchService: SearchService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('search')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Semantic search for resumes',
    description: 'Search resumes using AI-powered semantic understanding. Finds resumes by meaning, not just keywords.',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results with similarity scores',
    type: SearchResumesResponse,
  })
  async searchResumes(
    @Body() searchDto: SearchResumesDto,
    @CurrentUser() user?: any,
  ): Promise<SearchResumesResponse> {
    return this.searchService.searchResumes(searchDto, user?.userId);
  }

  @Post('generate/:resumeId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger embedding generation for a resume' })
  @ApiResponse({
    status: 202,
    description: 'Embedding generation job queued successfully',
  })
  @ApiResponse({ status: 404, description: 'Resume not found' })
  @ApiResponse({ status: 403, description: 'Not authorized to modify this resume' })
  async generateEmbedding(
    @Param('resumeId') resumeId: string,
    @CurrentUser() user: any,
  ) {
    // Verify resume exists and belongs to user
    const resume = await this.prisma.resume.findUnique({
      where: { id: resumeId },
      select: { id: true, userId: true },
    });

    if (!resume) {
      throw new Error('Resume not found');
    }

    if (resume.userId !== user.userId) {
      throw new Error('Not authorized to modify this resume');
    }

    const jobId = await this.embeddingQueueService.addEmbeddingJob(
      resumeId,
      EmbeddingJobType.MANUAL,
      user.userId,
    );

    return {
      message: 'Embedding generation queued',
      jobId,
      resumeId,
    };
  }

  @Post('generate-bulk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger embedding generation for all user resumes' })
  @ApiResponse({
    status: 202,
    description: 'Bulk embedding generation jobs queued successfully',
  })
  async generateBulkEmbeddings(@CurrentUser() user: any) {
    // Get all user resumes
    const resumes = await this.prisma.resume.findMany({
      where: { userId: user.userId },
      select: { id: true },
    });

    const jobIds = await Promise.all(
      resumes.map((resume) =>
        this.embeddingQueueService.addEmbeddingJob(
          resume.id,
          EmbeddingJobType.MANUAL,
          user.userId,
        ),
      ),
    );

    return {
      message: 'Bulk embedding generation queued',
      totalResumes: resumes.length,
      jobIds,
    };
  }

  @Get('job/:jobId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get embedding job status' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.embeddingQueueService.getJobStatus(jobId);

    if (!status) {
      throw new Error('Job not found');
    }

    return status;
  }

  @Get('queue/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get embedding queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved' })
  async getQueueStats() {
    return this.embeddingQueueService.getQueueStats();
  }

  @Delete('queue/failed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear all failed jobs from the queue' })
  @ApiResponse({ status: 204, description: 'Failed jobs cleared' })
  async clearFailedJobs() {
    const clearedCount = await this.embeddingQueueService.clearFailedJobs();
    return { message: `Cleared ${clearedCount} failed jobs` };
  }
}
