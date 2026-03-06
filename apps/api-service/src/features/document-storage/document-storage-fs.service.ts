import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { IDocumentStorageService } from './document-storage.interface';

@Injectable()
export class DocumentStorageFsService implements IDocumentStorageService {
  private readonly logger = new Logger(DocumentStorageFsService.name);
  private readonly storageDir: string;
  private readonly baseUrl: string;

  constructor() {
    // Store files in uploads directory
    this.storageDir = process.env.FS_STORAGE_DIR || path.join(process.cwd(), 'uploads', 'documents');
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

    // Ensure storage directory exists
    this.ensureStorageDir();
    this.logger.log(`Filesystem storage initialized: ${this.storageDir}`);
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create storage directory: ${error.message}`);
    }
  }

  /**
   * Generate filesystem path for a user's document.
   */
  private getFilePath(userId: string, fileName: string): string {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const userDir = path.join(this.storageDir, userId);
    return path.join(userDir, `${timestamp}-${sanitizedFileName}`);
  }

  /**
   * Get relative path for URL generation.
   */
  private getRelativePath(fullPath: string): string {
    return path.relative(this.storageDir, fullPath);
  }

  async saveDoc(
    userId: string,
    fileName: string,
    content: Buffer | Readable,
    mimeType: string,
  ): Promise<string> {
    const filePath = this.getFilePath(userId, fileName);
    const userDir = path.dirname(filePath);

    try {
      // Ensure user directory exists
      await fs.mkdir(userDir, { recursive: true });

      // Write file
      if (Buffer.isBuffer(content)) {
        await fs.writeFile(filePath, content);
      } else {
        // Handle stream
        const writeStream = fsSync.createWriteStream(filePath);
        await new Promise<void>((resolve, reject) => {
          content.pipe(writeStream);
          writeStream.on('finish', () => resolve());
          writeStream.on('error', reject);
        });
      }

      this.logger.log(`File saved to filesystem: ${filePath}`);
      return this.getRelativePath(filePath);
    } catch (error) {
      this.logger.error(`Failed to save file to filesystem: ${error.message}`, error.stack);
      throw error;
    }
  }

  getDocHtmlEmbeddedCode(userId: string, fileName: string): string {
    const viewUrl = this.getDocLinkForViewing(userId, fileName);
    const fileExt = fileName.split('.').pop()?.toLowerCase();

    // Generate appropriate embed code based on file type
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(fileExt)) {
      return `![${fileName}](${viewUrl})`;
    } else if (['pdf'].includes(fileExt)) {
      return `[📄 ${fileName}](${viewUrl})`;
    } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExt)) {
      return `[📎 ${fileName}](${viewUrl})`;
    } else {
      return `[📁 ${fileName}](${viewUrl})`;
    }
  }

  getDocLinkForViewing(userId: string, fileName: string): string {
    // Return API endpoint URL for serving the file
    const encodedFileName = encodeURIComponent(fileName);
    return `${this.baseUrl}/api/documents/view/${userId}/${encodedFileName}`;
  }

  getDocLinkForDownloading(userId: string, fileName: string): string {
    const encodedFileName = encodeURIComponent(fileName);
    return `${this.baseUrl}/api/documents/download/${userId}/${encodedFileName}`;
  }

  async deleteDoc(userId: string, fileName: string): Promise<void> {
    const filePath = path.join(this.storageDir, fileName);

    try {
      await fs.unlink(filePath);
      this.logger.log(`File deleted from filesystem: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from filesystem: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getDocStream(userId: string, fileName: string): Promise<Readable> {
    const filePath = path.join(this.storageDir, fileName);

    try {
      // Check if file exists
      await fs.access(filePath);
      return fsSync.createReadStream(filePath);
    } catch (error) {
      this.logger.error(`Failed to get file stream from filesystem: ${error.message}`, error.stack);
      throw error;
    }
  }
}
