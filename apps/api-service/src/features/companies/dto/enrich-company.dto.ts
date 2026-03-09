import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnrichCompanyDto {
  @ApiProperty({
    description: 'Company name to enrich',
    example: 'Google',
  })
  @IsString()
  @IsNotEmpty()
  companyName: string;
}
