import { Module } from '@nestjs/common';
import { ResumesService } from './resumes.service';
import { ResumesController } from './resumes.controller';

@Module({
  providers: [ResumesService],
  controllers: [ResumesController],
})
export class ResumesModule {}
