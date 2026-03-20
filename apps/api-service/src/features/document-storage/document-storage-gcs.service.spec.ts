import { Readable, Writable } from 'stream';
import { Test, TestingModule } from '@nestjs/testing';
import { Storage } from '@google-cloud/storage';
import { DocumentStorageGcsService } from './document-storage-gcs.service';
import {
  DOCUMENT_STORAGE,
  DocumentStorageModule,
} from './document-storage.module';

const mockSave = jest.fn();
const mockDelete = jest.fn();
const mockExists = jest.fn();
const mockCreateReadStream = jest.fn();
const mockCreateWriteStream = jest.fn();
const mockFile = jest.fn(() => ({
  save: mockSave,
  delete: mockDelete,
  exists: mockExists,
  createReadStream: mockCreateReadStream,
  createWriteStream: mockCreateWriteStream,
}));
const mockBucket = jest.fn(() => ({
  file: mockFile,
}));

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: mockBucket,
  })),
}));

describe('DocumentStorageGcsService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1710000000000);

    process.env.DOCUMENT_STORAGE_TYPE = 'gcs';
    process.env.GCS_BUCKET_NAME = 'unit-test-bucket';
    process.env.GCS_PROJECT_ID = 'unit-test-project';
    process.env.API_BASE_URL = 'http://localhost:3000';
    delete process.env.GCS_KEY_FILENAME;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GCS_CREDENTIALS_JSON;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('uploads a buffer to GCS with sanitized key metadata', async () => {
    const service = new DocumentStorageGcsService();

    const key = await service.saveDoc(
      'user-123',
      'My Resume 2026.pdf',
      Buffer.from('pdf-bytes'),
      'application/pdf',
    );

    expect(key).toBe('documents/user-123/1710000000000-My_Resume_2026.pdf');
    expect(mockBucket).toHaveBeenCalledWith('unit-test-bucket');
    expect(mockFile).toHaveBeenCalledWith(
      'documents/user-123/1710000000000-My_Resume_2026.pdf',
    );
    expect(mockSave).toHaveBeenCalledWith(
      Buffer.from('pdf-bytes'),
      expect.objectContaining({
        resumable: false,
        contentType: 'application/pdf',
        metadata: expect.objectContaining({
          metadata: expect.objectContaining({
            userId: 'user-123',
            originalFileName: 'My Resume 2026.pdf',
          }),
        }),
      }),
    );
  });

  it('streams uploads to GCS when content is a readable stream', async () => {
    const service = new DocumentStorageGcsService();

    mockCreateWriteStream.mockImplementation(() => {
      const writable = new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      });

      setImmediate(() => writable.emit('finish'));
      return writable;
    });

    const key = await service.saveDoc(
      'user-456',
      'portfolio.png',
      Readable.from(['image-bytes']),
      'image/png',
    );

    expect(key).toBe('documents/user-456/1710000000000-portfolio.png');
    expect(mockCreateWriteStream).toHaveBeenCalledWith(
      expect.objectContaining({
        resumable: false,
        contentType: 'image/png',
      }),
    );
  });

  it('returns API-backed view and download URLs', () => {
    const service = new DocumentStorageGcsService();

    expect(
      service.getDocLinkForViewing(
        'user-123',
        'documents/user-123/1710000000000-My_Resume_2026.pdf',
      ),
    ).toBe(
      'http://localhost:3000/api/documents/view/user-123/documents%2Fuser-123%2F1710000000000-My_Resume_2026.pdf',
    );

    expect(
      service.getDocLinkForDownloading(
        'user-123',
        'documents/user-123/1710000000000-My_Resume_2026.pdf',
      ),
    ).toBe(
      'http://localhost:3000/api/documents/download/user-123/documents%2Fuser-123%2F1710000000000-My_Resume_2026.pdf',
    );
  });

  it('returns a readable stream for an existing GCS object', async () => {
    const service = new DocumentStorageGcsService();
    const readable = Readable.from(['stored-content']);

    mockExists.mockResolvedValue([true]);
    mockCreateReadStream.mockReturnValue(readable);

    const result = await service.getDocStream(
      'user-123',
      'documents/user-123/1710000000000-My_Resume_2026.pdf',
    );

    expect(result).toBe(readable);
    expect(mockExists).toHaveBeenCalled();
    expect(mockCreateReadStream).toHaveBeenCalled();
  });

  it('selects the GCS provider from the document storage module factory', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [DocumentStorageModule],
    }).compile();

    const storageService = moduleRef.get(DOCUMENT_STORAGE);

    expect(storageService).toBeInstanceOf(DocumentStorageGcsService);
    expect(Storage).toHaveBeenCalled();
  });
});