import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRecruiterInterestDto {
  @ApiProperty({ description: 'Resume slug' })
  @IsString()
  @IsNotEmpty()
  resumeSlug: string;

  @ApiProperty({ description: 'Recruiter name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Recruiter email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ description: 'Company name' })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiProperty({ description: 'Message from recruiter' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
