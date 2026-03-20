# Document Storage Feature

A flexible document storage service that supports multiple storage backends (S3, GCS, filesystem, mock) with automatic provider selection based on environment configuration.

## Features

- **Multiple Storage Backends:**
  - **S3**: Production-ready AWS S3 storage
  - **GCS**: Production-ready Google Cloud Storage
  - **Filesystem**: Local development with file system storage
  - **Mock**: In-memory storage for testing

- **Aligned Behavior Across Providers:**
  - Consistent file key format: `documents/{userId}/{timestamp}-{sanitizedFileName}`
  - Consistent links through API endpoints (`/api/documents/view` and `/api/documents/download`)
  - Consistent markdown embed generation based on file extension

- **REST API Endpoints:**
  - `POST /api/documents/upload` - Upload documents with JWT authentication
  - `GET /api/documents/urls/:userId/:fileName` - Get document URLs (embed, view, download)
  - `GET /api/documents/view/:userId/:fileName` - View document in browser
  - `GET /api/documents/download/:userId/:fileName` - Download document
  - `DELETE /api/documents/:userId/:fileName` - Delete document (owner only)

- **Smart Embed Code Generation:**
  - Images: Markdown image syntax `![name](url)`
  - PDFs: Link with document icon 📄
  - Office files: Link with attachment icon 📎
  - Other files: Link with folder icon 📁

## Configuration

Set the storage type via environment variable:

```bash
# Use S3 (production)
DOCUMENT_STORAGE_TYPE=s3
API_BASE_URL=https://api.example.com
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=my-resume-documents
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key

# Use GCS (production)
DOCUMENT_STORAGE_TYPE=gcs
API_BASE_URL=https://api.example.com
GCS_BUCKET_NAME=my-resume-documents
GCS_PROJECT_ID=your-gcp-project-id
# Optional credential options:
# GCS_KEY_FILENAME=/path/to/service-account.json
# GCS_CREDENTIALS_JSON={"type":"service_account",...}

# Use filesystem (development)
DOCUMENT_STORAGE_TYPE=fs
FS_STORAGE_DIR=/path/to/uploads/documents
API_BASE_URL=http://localhost:3000

# Use mock (testing)
DOCUMENT_STORAGE_TYPE=mock
API_BASE_URL=http://localhost:3000
```

## Usage

### Upload a Document

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/document.pdf"
```

Response:
```json
{
  "fileKey": "documents/user123/1234567890-document.pdf",
  "embedCode": "[📄 1234567890-document.pdf](http://localhost:3000/api/documents/view/user123/documents%2Fuser123%2F1234567890-document.pdf)",
  "viewUrl": "http://localhost:3000/api/documents/view/user123/documents%2Fuser123%2F1234567890-document.pdf",
  "downloadUrl": "http://localhost:3000/api/documents/download/user123/documents%2Fuser123%2F1234567890-document.pdf"
}
```

### Embed in Resume Markdown

Copy the `embedCode` from the upload response and paste it into your resume:

```markdown
## Certifications

Here's my AWS certification:
[📄 1234567890-aws-certification.pdf](http://localhost:3000/api/documents/view/user123/documents%2Fuser123%2F1234567890-aws-certification.pdf)
```

### Integration with AI Context

Use this feature to allow users to upload supporting documents in journal posts that can be referenced in their resumes.

```typescript
import { Inject } from '@nestjs/common';
import { IDocumentStorageService, DOCUMENT_STORAGE } from './features/document-storage';

@Injectable()
export class JournalService {
  constructor(
    @Inject(DOCUMENT_STORAGE)
    private readonly storage: IDocumentStorageService,
  ) {}

  async attachDocumentToPost(userId: string, fileName: string, content: Buffer) {
    const fileKey = await this.storage.saveDoc(userId, fileName, content, 'application/pdf');
    const embedCode = this.storage.getDocHtmlEmbeddedCode(userId, fileKey);
    
    // Store embedCode in journal post or return to user
    return { fileKey, embedCode };
  }
}
```

## Architecture

### Interface-Based Design

All storage implementations follow the `IDocumentStorageService` interface:

```typescript
interface IDocumentStorageService {
  saveDoc(userId, fileName, content, mimeType): Promise<string>;
  getDocHtmlEmbeddedCode(userId, fileName): string;
  getDocLinkForViewing(userId, fileName): string;
  getDocLinkForDownloading(userId, fileName): string;
  deleteDoc(userId, fileName): Promise<void>;
  getDocStream(userId, fileName): Promise<Readable>;
}
```

### Provider Factory

The module uses a factory function to select the implementation at runtime:

```typescript
providers: [
  {
    provide: DOCUMENT_STORAGE,
    useFactory: () => {
      const type = process.env.DOCUMENT_STORAGE_TYPE || 'fs';
      
      switch (type) {
        case 's3': return new DocumentStorageS3Service();
        case 'gcs': return new DocumentStorageGcsService();
        case 'mock': return new DocumentStorageMockService();
        case 'fs': 
        default: return new DocumentStorageFsService();
      }
    }
  }
]
```

## File Organization

```
document-storage/
├── document-storage.interface.ts       # Interface definition
├── document-storage.module.ts          # NestJS module
├── document-storage.controller.ts      # REST API endpoints
├── document-storage-s3.service.ts      # S3 implementation
├── document-storage-gcs.service.ts     # GCS implementation
├── document-storage-fs.service.ts      # Filesystem implementation
├── document-storage-mock.service.ts    # Mock implementation
├── document-storage.utils.ts           # Shared key/link/embed utilities
├── dto/
│   └── upload-document.dto.ts          # DTOs and Swagger definitions
├── index.ts                            # Public exports
└── README.md                           # This file
```

## Testing

### Unit Tests

```typescript
import { Test } from '@nestjs/testing';
import { DocumentStorageMockService } from './document-storage-mock.service';

describe('DocumentStorageMockService', () => {
  let service: DocumentStorageMockService;

  beforeEach(() => {
    service = new DocumentStorageMockService();
  });

  it('should upload and retrieve document', async () => {
    const buffer = Buffer.from('test content');
    const key = await service.saveDoc('user1', 'test.txt', buffer, 'text/plain');
    
    expect(key).toContain('user1');
    expect(service.getStoredCount()).toBe(1);
    
    const stream = await service.getDocStream('user1', key);
    expect(stream).toBeDefined();
  });
});
```

### E2E Tests

```typescript
it('/documents/upload (POST)', () => {
  return request(app.getHttpServer())
    .post('/documents/upload')
    .set('Authorization', `Bearer ${jwtToken}`)
    .attach('file', './test/fixtures/test.pdf')
    .expect(201)
    .expect((res) => {
      expect(res.body.fileKey).toBeDefined();
      expect(res.body.embedCode).toContain('📄');
    });
});
```

## Security

- All upload/delete endpoints require JWT authentication
- Users can only delete their own documents
- File names are sanitized to prevent path traversal
- MIME type validation prevents executable uploads (TODO)
- Rate limiting via global throttler guard

## Future Enhancements

- [ ] Add file size limits
- [ ] Add MIME type whitelist/blacklist
- [ ] Add virus scanning integration
- [ ] Add image resizing/optimization
- [ ] Add CDN integration for faster delivery
- [ ] Add expiring signed URLs for S3
- [ ] Add document versioning
- [ ] Add bulk upload endpoint
- [ ] Add thumbnail generation for images/PDFs
