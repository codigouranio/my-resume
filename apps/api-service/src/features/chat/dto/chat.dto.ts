import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for chat request from frontend
 */
export class ChatRequestDto {
  @ApiProperty({
    description: 'User message/question',
    example: 'What is your experience with AWS?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @ApiProperty({
    description: 'Resume slug',
    example: 'jose-blanco',
  })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({
    description: 'Optional conversation ID for maintaining context',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}

/**
 * DTO for chat response to frontend
 */
export class ChatResponseDto {
  @ApiProperty({
    description: 'AI-generated response',
    example: 'I have extensive experience with AWS services including EC2, S3, Lambda...',
  })
  response: string;

  @ApiProperty({
    description: 'Conversation ID for context tracking',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  conversationId: string;
}
