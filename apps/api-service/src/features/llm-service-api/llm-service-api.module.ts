import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LlmServiceApiController } from './llm-service-api.controller';
import { LlmServiceApiService } from './llm-service-api.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '1h', // LLM service tokens expire in 1 hour
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [LlmServiceApiController],
  providers: [LlmServiceApiService],
  exports: [LlmServiceApiService],
})
export class LlmServiceApiModule {}
