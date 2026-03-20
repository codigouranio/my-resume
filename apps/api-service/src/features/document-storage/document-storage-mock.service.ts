import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { IDocumentStorageService } from './document-storage.interface';
import {
  assertDocumentKeyOwnership,
  buildDocumentEmbedCode,
  buildDocumentKey,
  buildDocumentRouteUrl,
  normalizeApiBaseUrl,
} from './document-storage.utils';

/**
 * Mock storage service for testing.
 * Stores files in memory instead of persistent storage.
 */
@Injectable()
export class DocumentStorageMockService implements IDocumentStorageService {
  private readonly logger = new Logger(DocumentStorageMockService.name);
  private readonly storage: Map<string, Buffer> = new Map();
  private readonly metadata: Map<string, { mimeType: string; originalName: string }> = new Map();
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = normalizeApiBaseUrl(process.env.API_BASE_URL);
    this.logger.log('Mock storage initialized (in-memory only)');
  }

  async saveDoc(
    userId: string,
    fileName: string,
    content: Buffer | Readable,
    mimeType: string,
  ): Promise<string> {
    const key = buildDocumentKey(userId, fileName);

    try {
      let buffer: Buffer;

      if (Buffer.isBuffer(content)) {
        buffer = content;
      } else {
        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of content) {
          chunks.push(Buffer.from(chunk));
        }
        buffer = Buffer.concat(chunks);
      }

      this.storage.set(key, buffer);
      this.metadata.set(key, { mimeType, originalName: fileName });

      this.logger.log(`File saved to mock storage: ${key} (${buffer.length} bytes)`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to save file to mock storage: ${error.message}`, error.stack);
      throw error;
    }
  }

  getDocHtmlEmbeddedCode(userId: string, fileName: string): string {
    const viewUrl = this.getDocLinkForViewing(userId, fileName);
    return buildDocumentEmbedCode(fileName, viewUrl);
  }

  getDocLinkForViewing(userId: string, fileName: string): string {
    assertDocumentKeyOwnership(userId, fileName);
    return buildDocumentRouteUrl(this.baseUrl, 'view', userId, fileName);
  }

  getDocLinkForDownloading(userId: string, fileName: string): string {
    assertDocumentKeyOwnership(userId, fileName);
    return buildDocumentRouteUrl(this.baseUrl, 'download', userId, fileName);
  }

  async deleteDoc(userId: string, fileName: string): Promise<void> {
    assertDocumentKeyOwnership(userId, fileName);

    const deleted = this.storage.delete(fileName);
    this.metadata.delete(fileName);

    if (deleted) {
      this.logger.log(`File deleted from mock storage: ${fileName}`);
    } else {
      this.logger.warn(`File not found in mock storage: ${fileName}`);
    }
  }

  async getDocStream(userId: string, fileName: string): Promise<Readable> {
    assertDocumentKeyOwnership(userId, fileName);

    const buffer = this.storage.get(fileName);

    if (!buffer) {
      throw new Error(`File not found in mock storage: ${fileName}`);
    }

    // Convert buffer to readable stream
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null); // End of stream
    return readable;
  }

  /**
   * Testing utility: Get stored buffer directly.
   */
  getStoredBuffer(key: string): Buffer | undefined {
    return this.storage.get(key);
  }

  /**
   * Testing utility: Clear all stored files.
   */
  clearAll(): void {
    this.storage.clear();
    this.metadata.clear();
    this.logger.log('Mock storage cleared');
  }

  /**
   * Testing utility: Get number of stored files.
   */
  getStoredCount(): number {
    return this.storage.size;
  }
}
