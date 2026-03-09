import { Module, OnModuleInit } from '@nestjs/common';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { BullBoardController } from './bull-board.controller';

@Module({
  controllers: [BullBoardController],
  providers: [
    {
      provide: 'BULL_BOARD_INSTANCE',
      useFactory: (configService: ConfigService) => {
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/admin/queues');

        // Create the queue connection (must match your existing queue config)
        const companyQueue = new Queue('company-enrichment', {
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
            db: configService.get('REDIS_DB', 0),
          },
        });

        createBullBoard({
          queues: [new BullMQAdapter(companyQueue)],
          serverAdapter,
        });

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
    console.log('🎯 Bull Board available at: /admin/queues');
  }
}
