import { IsString, IsEmail, IsOptional, IsNotEmpty, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRecruiterInterestDto {
  @ApiProperty({ description: 'Resume slug', example: 'john-doe' })
  @Transform(({ value }) => value?.trim?.())
  @IsString({ message: 'Resume slug must be a string' })
  @IsNotEmpty({ message: 'Resume slug is required' })
  @MinLength(1, { message: 'Resume slug cannot be empty' })
  resumeSlug: string;

  @ApiProperty({ description: 'Recruiter name', example: 'Jane Smith' })
  @Transform(({ value }) => value?.trim?.())
  @IsString({ message: 'Recruiter name must be a string' })
  @IsNotEmpty({ message: 'Recruiter name is required' })
  @MinLength(1, { message: 'Recruiter name cannot be empty' })
  name: string;

  @ApiProperty({ description: 'Recruiter email', example: 'jane@company.com' })
  @Transform(({ value }) => value?.trim?.().toLowerCase?.())
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Recruiter email is required' })
  email: string;

  @ApiPropertyOptional({ description: 'Company name', example: 'Tech Corp' })
  @Transform(({ value }) => value?.trim?.())
  @IsString()
  @IsOptional()
  company?: string;

  @ApiProperty({ description: 'Message from recruiter', example: 'We are interested in your profile...' })
  @Transform(({ value }) => value?.trim?.())
  @IsString({ message: 'Message must be a string' })
  @IsNotEmpty({ message: 'Message is required' })
  @MinLength(10, { message: 'Message must be at least 10 characters long' })
  message: string;
}
