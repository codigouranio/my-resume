import { IsString, IsOptional, IsArray, IsEnum, IsDateString } from 'class-validator';

export enum InterviewStatus {
  APPLIED = 'APPLIED',
  SCREENING = 'SCREENING',
  TECHNICAL = 'TECHNICAL',
  ONSITE = 'ONSITE',
  FINAL_ROUND = 'FINAL_ROUND',
  OFFER = 'OFFER',
  NEGOTIATING = 'NEGOTIATING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export class CreateInterviewDto {
  @IsString()
  company: string;

  @IsString()
  position: string;

  @IsOptional()
  @IsString()
  jobUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillTags?: string[];

  @IsOptional()
  @IsString()
  resumeId?: string;

  @IsOptional()
  @IsString()
  recruiterName?: string;

  @IsOptional()
  @IsString()
  recruiterEmail?: string;

  @IsOptional()
  @IsString()
  recruiterPhone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recruiterLinks?: string[];

  @IsOptional()
  @IsDateString()
  appliedAt?: string;
}

export class UpdateInterviewDto {
  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  jobUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillTags?: string[];

  @IsOptional()
  @IsString()
  resumeId?: string;

  @IsOptional()
  @IsString()
  recruiterName?: string;

  @IsOptional()
  @IsString()
  recruiterEmail?: string;

  @IsOptional()
  @IsString()
  recruiterPhone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recruiterLinks?: string[];

  @IsOptional()
  @IsDateString()
  appliedAt?: string;
}

export class CreateTimelineEntryDto {
  @IsString()
  comment: string;

  @IsOptional()
  @IsEnum(InterviewStatus)
  statusChange?: InterviewStatus;

  @IsOptional()
  @IsString()
  attachmentName?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentType?: string;
}
