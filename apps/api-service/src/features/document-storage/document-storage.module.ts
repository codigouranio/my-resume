import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentStorageController } from './document-storage.controller';
import { DocumentStorageS3Service } from './document-storage-s3.service';
import { DocumentStorageGcsService } from './document-storage-gcs.service';
import { DocumentStorageFsService } from './document-storage-fs.service';
import { DocumentStorageMockService } from './document-storage-mock.service';
import { IDocumentStorageService } from './document-storage.interface';
import { DOCUMENT_STORAGE } from './document-storage.constants';

/**
 * Factory function to select the appropriate storage implementation
 * based on environment configuration.
 */
function documentStorageFactory(): IDocumentStorageService {
  const storageType = process.env.DOCUMENT_STORAGE_TYPE || 'fs';

  switch (storageType.toLowerCase()) {
    case 's3':
      return new DocumentStorageS3Service();
    case 'gcs':
      return new DocumentStorageGcsService();
    case 'mock':
      return new DocumentStorageMockService();
    case 'fs':
    default:
      return new DocumentStorageFsService();
  }
}

@Module({
  imports: [ConfigModule],
  controllers: [DocumentStorageController],
  providers: [
    {
      provide: DOCUMENT_STORAGE,
      useFactory: documentStorageFactory,
    },
    // Also provide concrete implementations for testing
    DocumentStorageS3Service,
    DocumentStorageGcsService,
    DocumentStorageFsService,
    DocumentStorageMockService,
  ],
  exports: [DOCUMENT_STORAGE],
})
export class DocumentStorageModule {}

export { DOCUMENT_STORAGE } from './document-storage.constants';
