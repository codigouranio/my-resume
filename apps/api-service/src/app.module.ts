import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/database/prisma.module';
import { AuthModule } from './features/auth/auth.module';
import { UsersModule } from './features/users/users.module';
import { ResumesModule } from './features/resumes/resumes.module';
import { TemplatesModule } from './features/templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ResumesModule,
    TemplatesModule,
  ],
})
export class AppModule {}
