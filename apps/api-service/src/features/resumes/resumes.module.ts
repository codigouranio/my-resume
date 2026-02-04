import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ResumesService } from './resumes.service';
import { ResumesController } from './resumes.controller';
import { ResumesResolver } from './resumes.resolver';
import {
  GetResumeHandler,
  GetResumeBySlugHandler,
  GetResumesHandler,
} from './queries/handlers';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { EmailModule } from '@shared/email/email.module';

const QueryHandlers = [
  GetResumeHandler,
  GetResumeBySlugHandler,
  GetResumesHandler,
];

@Module({
  imports: [CqrsModule, EmbeddingsModule, EmailModule],
  providers: [
    ResumesService,
    ResumesResolver,
    ...QueryHandlers,
  ],
  controllers: [ResumesController],
})
export class ResumesModule {}
