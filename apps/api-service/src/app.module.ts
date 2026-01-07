import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bull';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
        },
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
  ],
})
export class AppModule {}
