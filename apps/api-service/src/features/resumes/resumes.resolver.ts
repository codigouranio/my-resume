import { Resolver, Query, Args } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { Resume } from './models/resume.model';
import { GetResumeBySlugQuery } from './queries/get-resume-by-slug.query';
import { GetResumeQuery } from './queries/get-resume.query';
import { GetResumesQuery } from './queries/get-resumes.query';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Resolver(() => Resume)
export class ResumesResolver {
  constructor(private queryBus: QueryBus) {}

  @Public()
  @Query(() => Resume, { name: 'resume' })
  async getResumeBySlug(@Args('slug') slug: string) {
    return this.queryBus.execute(new GetResumeBySlugQuery(slug));
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => Resume, { name: 'myResume' })
  async getResume(
    @Args('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.queryBus.execute(new GetResumeQuery(id, user.id));
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => [Resume], { name: 'myResumes' })
  async getMyResumes(@CurrentUser() user: any) {
    return this.queryBus.execute(new GetResumesQuery(user.id));
  }
}
