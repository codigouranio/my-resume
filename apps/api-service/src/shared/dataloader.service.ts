// DataLoader para evitar N+1 queries
import * as DataLoader from 'dataloader';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DataLoaderService {
  constructor(private readonly prisma: PrismaService) {}

  // Loader para usuarios (batch de user queries)
  readonly userLoader = new DataLoader(async (userIds: readonly string[]) => {
    console.log(`🔄 Batch loading ${userIds.length} users in 1 query`);
    
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: [...userIds] }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        subscriptionTier: true
      }
    });

    // Mapear resultados por ID para que DataLoader sepa qué usuario corresponde a qué ID
    const userMap = users.reduce((map, user) => {
      map[user.id] = user;
      return map;
    }, {});

    // Retornar en el mismo orden de los IDs solicitados
    return userIds.map(id => userMap[id] || null);
  });

  // Loader para templates (batch de template queries)
  readonly templateLoader = new DataLoader(async (templateIds: readonly string[]) => {
    console.log(`🔄 Batch loading ${templateIds.length} templates in 1 query`);
    
    const templates = await this.prisma.template.findMany({
      where: {
        id: { in: [...templateIds] }
      }
    });

    const templateMap = templates.reduce((map, template) => {
      map[template.id] = template;
      return map;
    }, {});

    return templateIds.map(id => templateMap[id] || null);
  });

  // Loader para analytics (batch de analytics queries)
  readonly analyticsLoader = new DataLoader(async (resumeIds: readonly string[]) => {
    console.log(`🔄 Batch loading analytics for ${resumeIds.length} resumes`);
    
    const analytics = await this.prisma.chatAnalytics.findMany({
      where: {
        resumeId: { in: [...resumeIds] }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Agrupar analytics por resumeId
    const analyticsMap = analytics.reduce((map, analytic) => {
      if (!map[analytic.resumeId]) {
        map[analytic.resumeId] = [];
      }
      map[analytic.resumeId].push(analytic);
      return map;
    }, {});

    return resumeIds.map(id => analyticsMap[id] || []);
  });

  // Método para limpiar caches (important para datos que cambian)
  clearAll() {
    this.userLoader.clearAll();
    this.templateLoader.clearAll();
    this.analyticsLoader.clearAll();
  }

  clearUser(id: string) {
    this.userLoader.clear(id);
  }

  clearTemplate(id: string) {
    this.templateLoader.clear(id);
  }
}