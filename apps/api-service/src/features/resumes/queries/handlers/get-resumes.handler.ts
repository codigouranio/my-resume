import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { GetResumesQuery } from '../get-resumes.query';

@QueryHandler(GetResumesQuery)
export class GetResumesHandler implements IQueryHandler<GetResumesQuery> {
  constructor(private prisma: PrismaService) {}

  async execute(query: GetResumesQuery) {
    return this.prisma.resume.findMany({
      where: { userId: query.userId },
      include: {
        template: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }
}
