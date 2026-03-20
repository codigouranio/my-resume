import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Request,
  UseGuards,
  Res,
  BadRequestException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IDocumentStorageService } from './document-storage.interface';
import {
  DocumentUploadResponseDto,
  DocumentUrlsDto,
} from './dto/upload-document.dto';
import { DOCUMENT_STORAGE } from './document-storage.constants';

@ApiTags('documents')
@Controller('documents')
export class DocumentStorageController {
  private readonly logger = new Logger(DocumentStorageController.name);

  constructor(
    @Inject(DOCUMENT_STORAGE)
    private readonly storageService: IDocumentStorageService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded successfully',
    type: DocumentUploadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - no file provided' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadDocument(
    @Request() req,
    @UploadedFile() file: any,
  ): Promise<DocumentUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const userId = req.user.id;
    const fileName = file.originalname;
    const mimeType = file.mimetype;
    const content = file.buffer;
    const fileSizeBytes = file.size;
    const googProjectId = req.headers?.['x-goog-project-id'];

    this.logger.log(
      `Document upload started: userId=${userId}, fileName=${fileName}, mimeType=${mimeType}, sizeBytes=${fileSizeBytes}, xGoogProjectId=${googProjectId || 'missing'}`,
    );

    try {
      // Save document
      const fileKey = await this.storageService.saveDoc(userId, fileName, content, mimeType);

      // Get URLs
      const embedCode = this.storageService.getDocHtmlEmbeddedCode(userId, fileKey);
      const viewUrl = this.storageService.getDocLinkForViewing(userId, fileKey);
      const downloadUrl = this.storageService.getDocLinkForDownloading(userId, fileKey);

      this.logger.log(
        `Document upload succeeded: userId=${userId}, fileKey=${fileKey}, sizeBytes=${fileSizeBytes}, xGoogProjectId=${googProjectId || 'missing'}`,
      );

      return {
        fileKey,
        embedCode,
        viewUrl,
        downloadUrl,
      };
    } catch (error) {
      this.logger.error(
        `Document upload failed: userId=${userId}, fileName=${fileName}, sizeBytes=${fileSizeBytes}, xGoogProjectId=${googProjectId || 'missing'}, error=${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('urls/:userId/:fileName')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get document URLs' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'fileName', description: 'File name or key' })
  @ApiResponse({
    status: 200,
    description: 'URLs retrieved successfully',
    type: DocumentUrlsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDocumentUrls(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
  ): Promise<DocumentUrlsDto> {
    const embedCode = this.storageService.getDocHtmlEmbeddedCode(userId, fileName);
    const viewUrl = this.storageService.getDocLinkForViewing(userId, fileName);
    const downloadUrl = this.storageService.getDocLinkForDownloading(userId, fileName);

    return {
      embedCode,
      viewUrl,
      downloadUrl,
    };
  }

  @Get('view/:userId/:fileName')
  @ApiOperation({ summary: 'View a document (serves file for viewing in browser)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'fileName', description: 'File name or key' })
  @ApiResponse({ status: 200, description: 'File served successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async viewDocument(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const stream = await this.storageService.getDocStream(userId, fileName);
      
      // Set appropriate headers
      res.setHeader('Content-Type', this.getMimeType(fileName));
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      
      stream.pipe(res);
    } catch (error) {
      throw new NotFoundException('Document not found');
    }
  }

  @Get('download/:userId/:fileName')
  @ApiOperation({ summary: 'Download a document' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'fileName', description: 'File name or key' })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async downloadDocument(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const stream = await this.storageService.getDocStream(userId, fileName);
      
      // Set headers for download
      res.setHeader('Content-Type', this.getMimeType(fileName));
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      stream.pipe(res);
    } catch (error) {
      throw new NotFoundException('Document not found');
    }
  }

  @Delete(':userId/:fileName')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'fileName', description: 'File name or key' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteDocument(
    @Request() req,
    @Param('userId') userId: string,
    @Param('fileName') fileName: string,
  ): Promise<{ message: string }> {
    // Verify user owns the document
    if (req.user.id !== userId) {
      throw new BadRequestException('Cannot delete documents of other users');
    }

    try {
      await this.storageService.deleteDoc(userId, fileName);
      return { message: 'Document deleted successfully' };
    } catch (error) {
      throw new NotFoundException('Document not found');
    }
  }

  /**
   * Helper method to determine MIME type from file extension.
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text
      txt: 'text/plain',
      csv: 'text/csv',
      html: 'text/html',
      xml: 'application/xml',
      json: 'application/json',
      // Archives
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}
