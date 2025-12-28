import {
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateResumeDto {
  @ApiProperty({ example: 'john-doe' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  slug: string;

  @ApiProperty({ example: 'Software Engineer Resume' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: '# My Resume\n\n## Experience...' })
  @IsString()
  content: string;

  @ApiProperty({ 
    required: false,
    example: 'Detailed accomplishments, metrics, private notes for AI context...',
    description: 'Hidden content only accessible to LLAMA for better context'
  })
  @IsOptional()
  @IsString()
  llmContext?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ required: false, example: 'default' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customCss?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  metaDescription?: string;
}
