import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { GetResumeBySlugQuery } from '../get-resume-by-slug.query';

@QueryHandler(GetResumeBySlugQuery)
export class GetResumeBySlugHandler implements IQueryHandler<GetResumeBySlugQuery> {
  constructor(private prisma: PrismaService) {}

  async execute(query: GetResumeBySlugQuery) {
    const resume = await this.prisma.resume.findUnique({
      where: { slug: query.slug },
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
    await this.prisma.resume.update({
      where: { id: resume.id },
      data: { viewCount: { increment: 1 } },
    });

    // Exclude llmContext from public response
    const { llmContext, ...publicResume } = resume;

    return publicResume;
  }
}
