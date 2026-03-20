import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { IDocumentStorageService } from './document-storage.interface';
import {
  buildDocumentEmbedCode,
  buildDocumentKey,
  buildDocumentRouteUrl,
  normalizeApiBaseUrl,
  resolveFsPathFromDocumentKey,
} from './document-storage.utils';

@Injectable()
export class DocumentStorageFsService implements IDocumentStorageService {
  private readonly logger = new Logger(DocumentStorageFsService.name);
  private readonly storageDir: string;
  private readonly baseUrl: string;

  constructor() {
    // Store files in uploads/documents directory by default
    this.storageDir = process.env.FS_STORAGE_DIR || path.join(process.cwd(), 'uploads', 'documents');
    this.baseUrl = normalizeApiBaseUrl(process.env.API_BASE_URL);

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

  async saveDoc(
    userId: string,
    fileName: string,
    content: Buffer | Readable,
    mimeType: string,
  ): Promise<string> {
    const fileKey = buildDocumentKey(userId, fileName);
    const filePath = resolveFsPathFromDocumentKey(this.storageDir, userId, fileKey);
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
      return fileKey;
    } catch (error) {
      this.logger.error(`Failed to save file to filesystem: ${error.message}`, error.stack);
      throw error;
    }
  }

  getDocHtmlEmbeddedCode(userId: string, fileName: string): string {
    const viewUrl = this.getDocLinkForViewing(userId, fileName);
    return buildDocumentEmbedCode(fileName, viewUrl);
  }

  getDocLinkForViewing(userId: string, fileName: string): string {
    return buildDocumentRouteUrl(this.baseUrl, 'view', userId, fileName);
  }

  getDocLinkForDownloading(userId: string, fileName: string): string {
    return buildDocumentRouteUrl(this.baseUrl, 'download', userId, fileName);
  }

  async deleteDoc(userId: string, fileName: string): Promise<void> {
    const filePath = resolveFsPathFromDocumentKey(this.storageDir, userId, fileName);

    try {
      await fs.unlink(filePath);
      this.logger.log(`File deleted from filesystem: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from filesystem: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getDocStream(userId: string, fileName: string): Promise<Readable> {
    const filePath = resolveFsPathFromDocumentKey(this.storageDir, userId, fileName);

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
