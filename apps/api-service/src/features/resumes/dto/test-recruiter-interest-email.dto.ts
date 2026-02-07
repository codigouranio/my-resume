import { IsEmail, IsOptional, IsString } from 'class-validator';

export class TestRecruiterInterestEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  recruiterName: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsString()
  message: string;

  @IsString()
  resumeTitle: string;
}