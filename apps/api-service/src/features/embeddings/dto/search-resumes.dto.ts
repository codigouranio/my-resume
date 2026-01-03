import { IsString, IsOptional, IsBoolean, IsInt, Min, Max, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SearchResumesDto {
  @ApiProperty({
    description: 'Search query text',
    example: 'experienced Python developer with AWS and Docker skills',
  })
  @IsString()
  @MinLength(3)
  query: string;

  @ApiProperty({
    description: 'Only search public resumes',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  publicOnly?: boolean = true;

  @ApiProperty({
    description: 'Filter by specific user ID (admin or owner only)',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Number of results to return',
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

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
    description: 'Minimum similarity score (0-1), where 1 is perfect match',
    required: false,
    default: 0.7,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  minSimilarity?: number = 0.7;
}

export class SearchResultItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  userId: string;
  user?: {
    firstName: string;
    lastName: string;
  };
  similarity: number; // 0-1, where 1 is perfect match
  rank: number; // Position in results (1-based)
}

export class SearchResumesResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  limit: number;
  offset: number;
  executionTime: number; // milliseconds
}
