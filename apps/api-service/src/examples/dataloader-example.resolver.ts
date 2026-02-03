// GraphQL Resolver con DataLoader - ANTES vs DESPUÉS

import { Resolver, Query, ResolveField, Parent } from '@nestjs/graphql';
import { Resume } from '../models/resume.model';
import { DataLoader, DataLoaderService } from '../../../shared/decorators/dataloader.decorator';

// =====================================
// ❌ ANTES (N+1 queries problemático)
// =====================================
@Resolver(() => Resume)
export class ResumeResolverOld {
  @ResolveField(() => User)
  async user(@Parent() resume: Resume) {
    // ❌ Esto se ejecuta por CADA resume!
    // Si hay 10 resumes = 10 queries adicionales
    return this.prisma.user.findUnique({ 
      where: { id: resume.userId } 
    });
  }
}

// =====================================
// ✅ DESPUÉS (Con DataLoader - 1 query total)
// =====================================
@Resolver(() => Resume)
export class ResumeResolver {
  @Query(() => [Resume])
  async resumes() {
    // 1. Primera query: obtener todos los resumes
    return this.prisma.resume.findMany({
      where: { isPublic: true, isPublished: true }
    });
  }

  @ResolveField(() => User)
  async user(
    @Parent() resume: Resume,
    @DataLoader() dataLoader: DataLoaderService
  ) {
    // ✅ DataLoader agrupa todos los userIds
    // y hace UNA SOLA query con todos los usuarios
    return dataLoader.userLoader.load(resume.userId);
  }

  @ResolveField(() => Template)
  async template(
    @Parent() resume: Resume,
    @DataLoader() dataLoader: DataLoaderService
  ) {
    if (!resume.templateId) return null;
    
    // ✅ También batching para templates
    return dataLoader.templateLoader.load(resume.templateId);
  }

  @ResolveField(() => [ChatAnalytics])
  async analytics(
    @Parent() resume: Resume,
    @DataLoader() dataLoader: DataLoaderService
  ) {
    // ✅ Y para analytics también
    return dataLoader.analyticsLoader.load(resume.id);
  }
}