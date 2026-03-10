import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScorePositionDto {
  @ApiProperty({
    description: 'Interview ID to score',
    example: 'cm123abc456',
  })
  @IsString()
  @IsNotEmpty()
  interviewId: string;

  @ApiProperty({
    description: 'Company name',
    example: 'Google',
  })
  @IsString()
  @IsNotEmpty()
  company: string;

  @ApiProperty({
    description: 'Position title',
    example: 'Senior Software Engineer',
  })
  @IsString()
  @IsNotEmpty()
  position: string;

  @ApiPropertyOptional({
    description: 'URL to job posting (optional, will be fetched if provided)',
    example: 'https://careers.google.com/jobs/123456',
  })
  @IsString()
  @IsOptional()
  jobUrl?: string;

  @ApiPropertyOptional({
    description: 'Job description text (optional, used if jobUrl not provided)',
    example: 'We are looking for a Senior Software Engineer...',
  })
  @IsString()
  @IsOptional()
  jobDescription?: string;
}
