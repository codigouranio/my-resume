import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { GetResumeQuery } from '../get-resume.query';

@QueryHandler(GetResumeQuery)
export class GetResumeHandler implements IQueryHandler<GetResumeQuery> {
  constructor(private prisma: PrismaService) {}

  async execute(query: GetResumeQuery) {
    const resume = await this.prisma.resume.findUnique({
      where: { id: query.id },
      include: {
        template: true,
      },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    // If userId is provided, verify ownership
    if (query.userId && resume.userId !== query.userId) {
      throw new ForbiddenException('Access denied');
    }

    return resume;
  }
}
