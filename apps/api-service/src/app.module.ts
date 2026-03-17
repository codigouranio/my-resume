import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bull';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { PrismaModule } from './shared/database/prisma.module';
import { AuthModule } from './features/auth/auth.module';
import { UsersModule } from './features/users/users.module';
import { ResumesModule } from './features/resumes/resumes.module';
import { TemplatesModule } from './features/templates/templates.module';
import { BadgesModule } from './features/badges/badges.module';
import { SubscriptionsModule } from './features/subscriptions/subscriptions.module';
import { EmbeddingsModule } from './features/embeddings/embeddings.module';
import { ChatAnalyticsModule } from './features/analytics/chat-analytics.module';
import { AIContextModule } from './features/ai-context/ai-context.module';
import { DocumentStorageModule } from './features/document-storage/document-storage.module';
import { InterviewsModule } from './features/interviews/interviews.module';
import { CompaniesModule } from './features/companies/companies.module';
import { LlmServiceApiModule } from './features/llm-service-api/llm-service-api.module';
import { ChatModule } from './features/chat/chat.module';
import { AppThrottlerGuard } from './shared/guards/throttler.guard';
import { CustomBullBoardModule } from './shared/bull-board/bull-board.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
      expandVariables: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env.LOG_LEVEL ??
          (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
        // Use pino-pretty only in development, JSON in production for PM2
        transport: process.env.NODE_ENV === 'production' 
          ? undefined 
          : {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: false,
                translateTime: 'SYS:standard',
                include: 'level,time',
                ignore: 'pid,hostname',
              },
            },
        timestamp: true,
        // Auto-log HTTP requests
        autoLogging: true,
        // Custom serializers for better log output
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
          tls: configService.get<string>('REDIS_HOST')?.includes('upstash.io') ? {} : undefined,
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL', 60),
            limit: configService.get<number>('THROTTLE_LIMIT', 120),
          },
        ],
      }),
      inject: [ConfigService],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req }) => ({ req }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ResumesModule,
    TemplatesModule,
    BadgesModule,
    SubscriptionsModule,
    EmbeddingsModule,
    ChatAnalyticsModule,
    AIContextModule,
    DocumentStorageModule,
    InterviewsModule,
    CompaniesModule,
    LlmServiceApiModule,
    ChatModule,
    CustomBullBoardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
