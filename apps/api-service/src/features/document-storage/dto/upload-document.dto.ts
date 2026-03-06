import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'The file to upload',
    type: 'string',
    format: 'binary',
  })
  file: any;
}

export class DocumentUploadResponseDto {
  @ApiProperty({ description: 'Stored file key/path' })
  fileKey: string;

  @ApiProperty({ description: 'HTML embed code for resume markdown' })
  embedCode: string;

  @ApiProperty({ description: 'URL for viewing the file' })
  viewUrl: string;

  @ApiProperty({ description: 'URL for downloading the file' })
  downloadUrl: string;
}

export class DocumentUrlsDto {
  @ApiProperty({ description: 'HTML embed code for resume markdown' })
  embedCode: string;

  @ApiProperty({ description: 'URL for viewing the file' })
  viewUrl: string;

  @ApiProperty({ description: 'URL for downloading the file' })
  downloadUrl: string;
}
