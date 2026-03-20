import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
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
export class DocumentStorageS3Service implements IDocumentStorageService {
  private readonly logger = new Logger(DocumentStorageS3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly baseUrl: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'my-resume-documents';
    this.baseUrl = normalizeApiBaseUrl(process.env.API_BASE_URL);

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    this.logger.log(`S3 storage initialized: bucket=${this.bucketName}, region=${this.region}`);
  }

  async saveDoc(
    userId: string,
    fileName: string,
    content: Buffer | Readable,
    mimeType: string,
  ): Promise<string> {
    const key = buildDocumentKey(userId, fileName);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: content,
        ContentType: mimeType,
        Metadata: {
          userId,
          originalFileName: fileName,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);
      this.logger.log(`File uploaded to S3: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`, error.stack);
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

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted from S3: ${fileName}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getDocStream(userId: string, fileName: string): Promise<Readable> {
    try {
      assertDocumentKeyOwnership(userId, fileName);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      const response = await this.s3Client.send(command);
      return response.Body as Readable;
    } catch (error) {
      this.logger.error(`Failed to get file stream from S3: ${error.message}`, error.stack);
      throw error;
    }
  }
}
