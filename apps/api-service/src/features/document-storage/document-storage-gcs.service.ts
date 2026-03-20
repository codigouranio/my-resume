import { Injectable, Logger } from '@nestjs/common';
import { Storage, StorageOptions } from '@google-cloud/storage';
import { Readable } from 'stream';
import { IDocumentStorageService } from './document-storage.interface';
import {
  assertDocumentKeyOwnership,
  buildDocumentEmbedCode,
  buildDocumentKey,
  buildDocumentRouteUrl,
  normalizeApiBaseUrl,
} from './document-storage.utils';

@Injectable()
export class DocumentStorageGcsService implements IDocumentStorageService {
  private readonly logger = new Logger(DocumentStorageGcsService.name);
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly baseUrl: string;

  constructor() {
    this.bucketName = process.env.GCS_BUCKET_NAME || 'my-resume-documents';
    this.baseUrl = normalizeApiBaseUrl(process.env.API_BASE_URL);

    this.storage = new Storage(this.getStorageOptions());

    this.logger.log(`GCS storage initialized: bucket=${this.bucketName}`);
  }

  private getStorageOptions(): StorageOptions {
    const options: StorageOptions = {};
    const projectId = process.env.GCS_PROJECT_ID;
    const keyFilename =
      process.env.GCS_KEY_FILENAME || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credentialsJson = process.env.GCS_CREDENTIALS_JSON;

    if (projectId) {
      options.projectId = projectId;
    }

    if (keyFilename) {
      options.keyFilename = keyFilename;
    }

    if (credentialsJson) {
      try {
        options.credentials = JSON.parse(credentialsJson);
      } catch (error) {
        this.logger.error(
          `Failed to parse GCS_CREDENTIALS_JSON: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }

    return options;
  }

  async saveDoc(
    userId: string,
    fileName: string,
    content: Buffer | Readable,
    mimeType: string,
  ): Promise<string> {
    const objectKey = buildDocumentKey(userId, fileName);
    const file = this.storage.bucket(this.bucketName).file(objectKey);

    try {
      if (Buffer.isBuffer(content)) {
        await file.save(content, {
          resumable: false,
          contentType: mimeType,
          metadata: {
            metadata: {
              userId,
              originalFileName: fileName,
              uploadedAt: new Date().toISOString(),
            },
          },
        });
      } else {
        await new Promise<void>((resolve, reject) => {
          const writeStream = file.createWriteStream({
            resumable: false,
            contentType: mimeType,
            metadata: {
              metadata: {
                userId,
                originalFileName: fileName,
                uploadedAt: new Date().toISOString(),
              },
            },
          });

          content.pipe(writeStream);
          writeStream.on('finish', () => resolve());
          writeStream.on('error', (error) => reject(error));
        });
      }

      this.logger.log(`File uploaded to GCS: ${objectKey}`);
      return objectKey;
    } catch (error) {
      this.logger.error(
        `Failed to upload file to GCS: ${error.message}`,
        error.stack,
      );
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
    try {
      assertDocumentKeyOwnership(userId, fileName);
      await this.storage.bucket(this.bucketName).file(fileName).delete();
      this.logger.log(`File deleted from GCS: ${fileName}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete file from GCS: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getDocStream(userId: string, fileName: string): Promise<Readable> {
    assertDocumentKeyOwnership(userId, fileName);
    const file = this.storage.bucket(this.bucketName).file(fileName);

    try {
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File not found in GCS: ${fileName}`);
      }

      return file.createReadStream();
    } catch (error) {
      this.logger.error(
        `Failed to get file stream from GCS: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}