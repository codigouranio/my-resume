import { IsString, IsOptional, IsBoolean, IsInt, Min, Max, MinLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UnifiedSearchDto {
  @ApiProperty({
    description: 'Search query text',
    example: 'experienced Python developer with AWS and Docker skills',
  })
  @IsString()
  @MinLength(3)
  query: string;

  @ApiProperty({
    description: 'Type of content to search',
    required: false,
    default: 'all',
    enum: ['all', 'resumes', 'journals'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'resumes', 'journals'])
  type?: 'all' | 'resumes' | 'journals' = 'all';

  @ApiProperty({
    description: 'Only search public content',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  publicOnly?: boolean = true;

  @ApiProperty({
    description: 'Filter by specific user ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Number of results to return',
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({
    description: 'Number of results to skip (for pagination)',
    required: false,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @ApiProperty({
    description: 'Minimum similarity threshold (0-1, where 1 is perfect match)',
    required: false,
    default: 0.4,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  minSimilarity?: number = 0.4;
}

export interface UnifiedSearchResultItem {
  id: string;
  type: 'resume' | 'journal';
  slug?: string; // Only for resumes
  title?: string; // Only for resumes
  text?: string; // Only for journal posts
  content: string;
  userId: string;
  user?: {
    firstName: string;
    lastName: string;
  };
  publishedAt?: string; // Only for journal posts
  similarity: number;
  rank: number;
}

export class UnifiedSearchResponse {
  @ApiProperty()
  query: string;

  @ApiProperty({ type: [Object] })
  results: UnifiedSearchResultItem[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  resumeCount: number;

  @ApiProperty()
  journalCount: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;

  @ApiProperty()
  executionTime: number;
}
