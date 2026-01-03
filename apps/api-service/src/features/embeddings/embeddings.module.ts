import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmbeddingsController } from './embeddings.controller';
import { EmbeddingQueueService } from './embedding-queue.service';
import { EmbeddingProcessor } from './embedding.processor';
import { PrismaModule } from '@shared/database/prisma.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    BullModule.registerQueueAsync({
      name: 'embeddings',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [EmbeddingsController],
  providers: [EmbeddingQueueService, EmbeddingProcessor],
  exports: [EmbeddingQueueService], // Export for use in ResumesModule
})
export class EmbeddingsModule {}
