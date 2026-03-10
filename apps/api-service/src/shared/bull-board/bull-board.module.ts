import { Module, OnModuleInit } from '@nestjs/common';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

@Module({
  providers: [
    {
      provide: 'BULL_BOARD_INSTANCE',
      useFactory: (configService: ConfigService) => {
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/api/admin/queues');

        // Create the queue connection (must match your existing queue config)
        const redisConfig = {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        };

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

        createBullBoard({
          queues: [
            new BullMQAdapter(companyQueue),
            new BullMQAdapter(positionScoringQueue),
          ],
          serverAdapter,
        });

        console.log('✅ Bull Board initialized with company-enrichment and position-scoring queues');

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
