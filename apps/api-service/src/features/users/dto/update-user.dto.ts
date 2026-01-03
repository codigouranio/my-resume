import { IsOptional, IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false, description: 'Custom subdomain (PRO feature only)' })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Subdomain must be at least 3 characters' })
  @MaxLength(63, { message: 'Subdomain must be at most 63 characters' })
  @Matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, {
    message: 'Subdomain must contain only lowercase letters, numbers, and hyphens (no hyphens at start/end)'
  })
  customDomain?: string;

  @ApiProperty({ required: false, description: 'Default resume to show at custom subdomain root (PRO feature)' })
  @IsOptional()
  @IsString()
  defaultResumeId?: string;
}
