import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsEnum } from 'class-validator';

export enum ChatSentiment {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
  UNKNOWN = 'UNKNOWN',
}

export class LogChatInteractionDto {
  @IsString()
  @IsNotEmpty()
  resumeSlug: string;

  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  answer: string;

  @IsNumber()
  @IsNotEmpty()
  responseTime: number;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsEnum(ChatSentiment)
  @IsOptional()
  sentiment?: ChatSentiment;

  @IsArray()
  @IsOptional()
  topics?: string[];

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  referrer?: string;
}
