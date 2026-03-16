import { Module, OnModuleInit } from '@nestjs/common';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { createRedisConfig } from '../redis/redis.config';

@Module({
  providers: [
    {
      provide: 'BULL_BOARD_INSTANCE',
      useFactory: (configService: ConfigService) => {
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/api/admin/queues');

        // Create the queue connection using shared config
        const redisConfig = createRedisConfig(configService);

        console.log('🔌 Connecting Bull Board to Redis:', {
          host: redisConfig.host,
          port: redisConfig.port,
          db: redisConfig.db,
        });

        const companyQueue = new Queue('company-enrichment', {
          connection: redisConfig,
        });

        const positionScoringQueue = new Queue('position-scoring', {
          connection: redisConfig,
        });

        // LLM communication queues (event-driven architecture)
        const llmCompanyResearchQueue = new Queue('llm-company-research', {
          connection: redisConfig,
        });

        const llmPositionResearchQueue = new Queue('llm-position-research', {
          connection: redisConfig,
        });

        const llmResultsQueue = new Queue('llm-research-results', {
          connection: redisConfig,
        });

        createBullBoard({
          queues: [
            new BullMQAdapter(companyQueue),
            new BullMQAdapter(positionScoringQueue),
            new BullMQAdapter(llmCompanyResearchQueue),
            new BullMQAdapter(llmPositionResearchQueue),
            new BullMQAdapter(llmResultsQueue),
          ],
          serverAdapter,
        });

        console.log('✅ Bull Board initialized with 5 queues: company-enrichment, position-scoring, llm-company-research, llm-position-research, llm-research-results');

        return serverAdapter;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['BULL_BOARD_INSTANCE'],
})
export class CustomBullBoardModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    console.log('🎯 Bull Board available at: /api/admin/queues (local network only - protected by nginx)');
  }
}
