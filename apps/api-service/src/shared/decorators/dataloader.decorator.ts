// Custom decorator para inyectar DataLoader
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DataLoaderService } from '../dataloader.service';

export const DataLoader = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    // Crear DataLoaderService por request (para evitar compartir entre requests)
    if (!request.dataloaderService) {
      request.dataloaderService = new DataLoaderService(
        request.app.get('PrismaService')
      );
    }
    
    return request.dataloaderService;
  },
);