import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EmbeddingJobType {
  CREATE = 'create',
  UPDATE = 'update',
  MANUAL = 'manual',
}

export class GenerateEmbeddingDto {
  @ApiProperty({ description: 'Resume ID to generate embeddings for' })
  @IsNotEmpty()
  @IsString()
  resumeId: string;

  @ApiProperty({
    description: 'Type of embedding generation job',
    enum: EmbeddingJobType,
    required: false,
    default: EmbeddingJobType.MANUAL,
  })
  @IsOptional()
  @IsEnum(EmbeddingJobType)
  type?: EmbeddingJobType = EmbeddingJobType.MANUAL;
}
