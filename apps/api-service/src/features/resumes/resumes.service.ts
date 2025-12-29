import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { CreateRecruiterInterestDto } from './dto/create-recruiter-interest.dto';

@Injectable()
export class ResumesService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.resume.create({
      data: {
        ...createResumeDto,
        userId,
      },
      include: {
        template: true,
      },
    });
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

  async findBySlug(slug: string, incrementView = false) {
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

    // Increment view count
    if (incrementView) {
      await this.prisma.resume.update({
        where: { id: resume.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    // Remove llmContext from public view
    const { llmContext, ...publicResume } = resume;

    return publicResume;
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

    return this.prisma.resume.update({
      where: { id },
      data: updateResumeDto,
      include: {
        template: true,
      },
    });
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
}
