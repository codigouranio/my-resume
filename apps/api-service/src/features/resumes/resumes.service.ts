import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { CreateRecruiterInterestDto } from './dto/create-recruiter-interest.dto';
import { EmbeddingQueueService } from '../embeddings/embedding-queue.service';
import { EmbeddingJobType } from '../embeddings/dto/generate-embedding.dto';
import * as crypto from 'crypto';

@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingQueueService: EmbeddingQueueService,
  ) {}

  async create(userId: string, createResumeDto: CreateResumeDto) {
    // Check if slug is already taken
    if (createResumeDto.slug) {
      const existing = await this.prisma.resume.findUnique({
        where: { slug: createResumeDto.slug },
      });
      if (existing) {
        throw new ConflictException('Slug already exists');
      }
    }

    const resume = await this.prisma.resume.create({
      data: {
        ...createResumeDto,
        userId,
      },
      include: {
        template: true,
      },
    });

    // Queue embedding generation asynchronously (don't await)
    this.embeddingQueueService
      .addEmbeddingJob(resume.id, EmbeddingJobType.CREATE, userId)
      .catch((error) => {
        this.logger.error(
          `Failed to queue embedding for resume ${resume.id}:`,
          error,
        );
      });

    return resume;
  }

  async findAll(userId: string) {
    return this.prisma.resume.findMany({
      where: { userId },
      include: {
        template: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId?: string) {
    const resume = await this.prisma.resume.findUnique({
      where: { id },
      include: {
        template: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    // If resume is not public and user is not the owner
    if (!resume.isPublic && resume.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return resume;
  }

  async findBySlug(
    slug: string,
    incrementView = false,
    viewData?: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      country?: string;
      city?: string;
    },
  ) {
    const resume = await this.prisma.resume.findUnique({
      where: { slug },
      include: {
        template: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    if (!resume.isPublic || !resume.isPublished) {
      throw new NotFoundException('Resume not found');
    }

    // Track detailed view
    if (incrementView && viewData) {
      await Promise.all([
        // Increment simple counter
        this.prisma.resume.update({
          where: { id: resume.id },
          data: { viewCount: { increment: 1 } },
        }),
        // Create detailed view record
        this.prisma.resumeView.create({
          data: {
            resumeId: resume.id,
            ipAddress: viewData.ipAddress,
            userAgent: viewData.userAgent,
            referrer: viewData.referrer,
            country: viewData.country,
            city: viewData.city,
          },
        }),
      ]);
    } else if (incrementView) {
      // Fallback to simple counter if no detailed data
      await this.prisma.resume.update({
        where: { id: resume.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    // Remove llmContext from public view
    const { llmContext, ...publicResume } = resume;

    return publicResume;
  }

  async findByCustomDomain(
    customDomain: string,
    incrementView: boolean = false,
    viewData?: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      country?: string;
      city?: string;
    },
  ) {
    // Find user with this custom domain
    const user = await this.prisma.user.findUnique({
      where: { customDomain },
      select: { id: true, defaultResumeId: true },
    });

    if (!user) {
      throw new NotFoundException('Custom domain not found');
    }

    let resume;

    // If user has set a default resume, use that
    if (user.defaultResumeId) {
      resume = await this.prisma.resume.findFirst({
        where: {
          id: user.defaultResumeId,
          userId: user.id,
          isPublic: true,
          isPublished: true,
        },
        include: {
          template: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    }

    // Fallback: Find user's first public published resume if no default set or default not found
    if (!resume) {
      resume = await this.prisma.resume.findFirst({
        where: {
          userId: user.id,
          isPublic: true,
          isPublished: true,
        },
        include: {
          template: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc', // Get most recent resume
        },
      });
    }

    if (!resume) {
      throw new NotFoundException('No public resume found for this domain');
    }

    // Track view
    if (incrementView && viewData) {
      await Promise.all([
        this.prisma.resume.update({
          where: { id: resume.id },
          data: { viewCount: { increment: 1 } },
        }),
        this.prisma.resumeView.create({
          data: {
            resumeId: resume.id,
            ipAddress: viewData.ipAddress,
            userAgent: viewData.userAgent,
            referrer: viewData.referrer,
            country: viewData.country,
            city: viewData.city,
          },
        }),
      ]);
    } else if (incrementView) {
      await this.prisma.resume.update({
        where: { id: resume.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    // Remove llmContext from public view
    const { llmContext, ...publicResume } = resume;

    return publicResume;
  }

  async getPublicStats(slug: string) {
    const resume = await this.prisma.resume.findUnique({
      where: { slug },
      select: {
        viewCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    return {
      viewCount: resume.viewCount,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
    };
  }

  async getResumeForLLM(slug: string) {
    const resume = await this.prisma.resume.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        content: true,
        llmContext: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!resume || !resume) {
      throw new NotFoundException('Resume not found');
    }

    // Combine public content with hidden context for LLAMA
    return {
      ...resume,
      fullContext: `${resume.content}\n\n<!-- ADDITIONAL CONTEXT FOR AI -->\n${resume.llmContext || ''}`,
    };
  }

  async update(id: string, userId: string, updateResumeDto: UpdateResumeDto) {
    const resume = await this.prisma.resume.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        slug: true,
        content: true,
        llmContext: true,
        embeddings: {
          select: {
            contentHash: true,
            llmContextHash: true,
          },
        },
      },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    if (resume.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Check slug uniqueness if updating
    if (updateResumeDto.slug && updateResumeDto.slug !== resume.slug) {
      const existing = await this.prisma.resume.findUnique({
        where: { slug: updateResumeDto.slug },
      });
      if (existing) {
        throw new ConflictException('Slug already exists');
      }
    }

    // Check if content or llmContext changed to determine if embeddings need regeneration
    let shouldRegenerateEmbeddings = false;

    if (updateResumeDto.content || updateResumeDto.llmContext !== undefined) {
      const newContentHash = updateResumeDto.content
        ? this.calculateHash(updateResumeDto.content)
        : this.calculateHash(resume.content);

      const newLlmContextHash =
        updateResumeDto.llmContext !== undefined
          ? updateResumeDto.llmContext
            ? this.calculateHash(updateResumeDto.llmContext)
            : null
          : resume.llmContext
          ? this.calculateHash(resume.llmContext)
          : null;

      // Compare hashes with existing embeddings
      if (resume.embeddings) {
        const contentChanged = newContentHash !== resume.embeddings.contentHash;
        const llmContextChanged =
          newLlmContextHash !== resume.embeddings.llmContextHash;
        shouldRegenerateEmbeddings = contentChanged || llmContextChanged;
      } else {
        // No embeddings yet, should generate
        shouldRegenerateEmbeddings = true;
      }
    }

    const updatedResume = await this.prisma.resume.update({
      where: { id },
      data: updateResumeDto,
      include: {
        template: true,
      },
    });

    // Queue embedding regeneration if content changed
    if (shouldRegenerateEmbeddings) {
      this.embeddingQueueService
        .addEmbeddingJob(id, EmbeddingJobType.UPDATE, userId)
        .catch((error) => {
          this.logger.error(
            `Failed to queue embedding update for resume ${id}:`,
            error,
          );
        });
    }

    return updatedResume;
  }

  /**
   * Calculate MD5 hash of text for change detection
   */
  private calculateHash(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  async remove(id: string, userId: string) {
    const resume = await this.prisma.resume.findUnique({
      where: { id },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    if (resume.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.resume.delete({
      where: { id },
    });
  }

  async createRecruiterInterest(dto: CreateRecruiterInterestDto) {
    // Find resume by slug
    const resume = await this.prisma.resume.findUnique({
      where: { slug: dto.resumeSlug },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    if (!resume.isPublic || !resume.isPublished) {
      throw new NotFoundException('Resume not available');
    }

    // Create recruiter interest
    return this.prisma.recruiterInterest.create({
      data: {
        resumeId: resume.id,
        name: dto.name,
        email: dto.email,
        company: dto.company,
        message: dto.message,
      },
    });
  }

  async getRecruiterInterests(userId: string) {
    // Get all resumes for this user
    const resumes = await this.prisma.resume.findMany({
      where: { userId },
      select: { id: true },
    });

    const resumeIds = resumes.map(r => r.id);

    // Get all recruiter interests for these resumes (excluding soft-deleted)
    return this.prisma.recruiterInterest.findMany({
      where: {
        resumeId: { in: resumeIds },
        deletedAt: null,
      },
      include: {
        resume: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async markInterestAsRead(interestId: string, userId: string) {
    const interest = await this.prisma.recruiterInterest.findUnique({
      where: { id: interestId },
      include: {
        resume: true,
      },
    });

    if (!interest) {
      throw new NotFoundException('Interest not found');
    }

    if (interest.resume.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.recruiterInterest.update({
      where: { id: interestId },
      data: { isRead: true },
    });
  }

  async deleteInterest(interestId: string, userId: string) {
    const interest = await this.prisma.recruiterInterest.findUnique({
      where: { id: interestId },
      include: {
        resume: true,
      },
    });

    if (!interest) {
      throw new NotFoundException('Interest not found');
    }

    if (interest.resume.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Soft delete: set deletedAt timestamp
    return this.prisma.recruiterInterest.update({
      where: { id: interestId },
      data: { deletedAt: new Date() },
    });
  }

  async toggleFavorite(interestId: string, userId: string) {
    const interest = await this.prisma.recruiterInterest.findUnique({
      where: { id: interestId },
      include: {
        resume: true,
      },
    });

    if (!interest) {
      throw new NotFoundException('Interest not found');
    }

    if (interest.resume.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.recruiterInterest.update({
      where: { id: interestId },
      data: { isFavorite: !interest.isFavorite },
    });
  }

  async getResumeAnalytics(resumeId: string, userId: string) {
    // Verify ownership
    const resume = await this.prisma.resume.findUnique({
      where: { id: resumeId },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    if (resume.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Get views data
    const [totalViews, recentViews, viewsByDay, viewsByCountry, viewsByReferrer] =
      await Promise.all([
        // Total views
        this.prisma.resumeView.count({
          where: { resumeId },
        }),
        // Recent views (last 30 days)
        this.prisma.resumeView.findMany({
          where: {
            resumeId,
            viewedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { viewedAt: 'desc' },
          take: 100,
          select: {
            id: true,
            viewedAt: true,
            country: true,
            city: true,
            referrer: true,
            userAgent: true,
          },
        }),
        // Views by day (last 30 days)
        this.prisma.$queryRaw`
          SELECT 
            DATE("viewedAt") as date,
            COUNT(*)::int as views
          FROM "ResumeView"
          WHERE "resumeId" = ${resumeId}
            AND "viewedAt" >= NOW() - INTERVAL '30 days'
          GROUP BY DATE("viewedAt")
          ORDER BY date DESC
        `,
        // Views by country
        this.prisma.$queryRaw`
          SELECT 
            COALESCE(country, 'Unknown') as country,
            COUNT(*)::int as views
          FROM "ResumeView"
          WHERE "resumeId" = ${resumeId}
          GROUP BY country
          ORDER BY views DESC
          LIMIT 10
        `,
        // Views by referrer
        this.prisma.$queryRaw`
          SELECT 
            CASE 
              WHEN referrer IS NULL THEN 'Direct'
              WHEN referrer LIKE '%google%' THEN 'Google'
              WHEN referrer LIKE '%linkedin%' THEN 'LinkedIn'
              WHEN referrer LIKE '%facebook%' THEN 'Facebook'
              WHEN referrer LIKE '%twitter%' THEN 'Twitter'
              ELSE 'Other'
            END as source,
            COUNT(*)::int as views
          FROM "ResumeView"
          WHERE "resumeId" = ${resumeId}
          GROUP BY source
          ORDER BY views DESC
        `,
      ]);

    return {
      totalViews: resume.viewCount,
      detailedViews: totalViews,
      recentViews,
      viewsByDay,
      viewsByCountry,
      viewsByReferrer,
    };
  }

  async getDetailedAnalytics(resumeId: string, userId: string) {
    // Verify ownership
    const resume = await this.prisma.resume.findUnique({
      where: { id: resumeId },
      include: { user: true },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    if (resume.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Check if user has PRO tier
    if (resume.user.subscriptionTier !== 'PRO' && resume.user.subscriptionTier !== 'ENTERPRISE') {
      throw new ForbiddenException('Detailed analytics requires PRO subscription');
    }

    // Get comprehensive analytics
    const [
      totalViews,
      uniqueVisitors,
      avgDuration,
      topReferrers,
      topCountries,
      recentViews
    ] = await Promise.all([
      // Total views
      this.prisma.resumeView.count({
        where: { resumeId },
      }),
      // Unique visitors (by session ID)
      this.prisma.resumeView.groupBy({
        by: ['sessionId'],
        where: { 
          resumeId,
          sessionId: { not: null }
        },
      }).then(sessions => sessions.length),
      // Average duration
      this.prisma.resumeView.aggregate({
        where: {
          resumeId,
          duration: { not: null }
        },
        _avg: { duration: true },
      }).then(result => Math.round(result._avg.duration || 0)),
      // Top referrers
      this.prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
            WHEN referrer LIKE '%google%' THEN 'Google'
            WHEN referrer LIKE '%linkedin%' THEN 'LinkedIn'
            WHEN referrer LIKE '%facebook%' THEN 'Facebook'
            WHEN referrer LIKE '%twitter%' THEN 'Twitter'
            WHEN referrer LIKE '%indeed%' THEN 'Indeed'
            WHEN referrer LIKE '%glassdoor%' THEN 'Glassdoor'
            ELSE 'Other'
          END as source,
          COUNT(*)::int as count
        FROM "ResumeView"
        WHERE "resumeId" = ${resumeId}
        GROUP BY source
        ORDER BY count DESC
        LIMIT 10
      `,
      // Top countries
      this.prisma.$queryRaw`
        SELECT 
          COALESCE(country, 'Unknown') as country,
          COUNT(*)::int as count
        FROM "ResumeView"
        WHERE "resumeId" = ${resumeId}
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `,
      // Recent views (last 50)
      this.prisma.resumeView.findMany({
        where: { resumeId },
        orderBy: { viewedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          viewedAt: true,
          country: true,
          city: true,
          referrer: true,
        },
      }),
    ]);

    return {
      totalViews,
      uniqueVisitors,
      avgDuration,
      topReferrers,
      topCountries,
      recentViews,
    };
  }

  async improveText(text: string, context: string = 'resume') {
    const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:5000';
    
    try {
      const response = await fetch(`${LLM_SERVICE_URL}/api/improve-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, context }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to improve text');
      }

      return response.json();
    } catch (error) {
      throw new Error(`LLM service error: ${error.message}`);
    }
  }
}
