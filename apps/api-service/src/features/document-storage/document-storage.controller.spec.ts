import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { DocumentStorageController } from './document-storage.controller';
import { IDocumentStorageService } from './document-storage.interface';
import { DOCUMENT_STORAGE } from './document-storage.module';

describe('DocumentStorageController', () => {
  let controller: DocumentStorageController;
  let storageService: jest.Mocked<IDocumentStorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentStorageController],
      providers: [
        {
          provide: DOCUMENT_STORAGE,
          useValue: {
            saveDoc: jest.fn(),
            getDocHtmlEmbeddedCode: jest.fn(),
            getDocLinkForViewing: jest.fn(),
            getDocLinkForDownloading: jest.fn(),
            deleteDoc: jest.fn(),
            getDocStream: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DocumentStorageController>(DocumentStorageController);
    storageService = module.get(DOCUMENT_STORAGE);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uploads a document and returns embed, view, and download URLs', async () => {
    storageService.saveDoc.mockResolvedValue('documents/user-1/1234-resume.pdf');
    storageService.getDocHtmlEmbeddedCode.mockReturnValue(
      '[📄 resume.pdf](http://localhost/view)',
    );
    storageService.getDocLinkForViewing.mockReturnValue('http://localhost/view');
    storageService.getDocLinkForDownloading.mockReturnValue(
      'http://localhost/download',
    );

    const result = await controller.uploadDocument(
      { user: { id: 'user-1' } },
      {
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('pdf-bytes'),
      },
    );

    expect(storageService.saveDoc).toHaveBeenCalledWith(
      'user-1',
      'resume.pdf',
      Buffer.from('pdf-bytes'),
      'application/pdf',
    );
    expect(result).toEqual({
      fileKey: 'documents/user-1/1234-resume.pdf',
      embedCode: '[📄 resume.pdf](http://localhost/view)',
      viewUrl: 'http://localhost/view',
      downloadUrl: 'http://localhost/download',
    });
  });

  it('rejects upload when no file is provided', async () => {
    await expect(
      controller.uploadDocument({ user: { id: 'user-1' } }, null),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns document URLs from the storage service', async () => {
    storageService.getDocHtmlEmbeddedCode.mockReturnValue('embed-code');
    storageService.getDocLinkForViewing.mockReturnValue('view-url');
    storageService.getDocLinkForDownloading.mockReturnValue('download-url');

    const result = await controller.getDocumentUrls(
      'user-1',
      'documents/user-1/1234-resume.pdf',
    );

    expect(result).toEqual({
      embedCode: 'embed-code',
      viewUrl: 'view-url',
      downloadUrl: 'download-url',
    });
  });

  it('streams documents for inline viewing with the expected headers', async () => {
    const pipe = jest.fn();
    storageService.getDocStream.mockResolvedValue({ pipe } as any);

    const response = {
      setHeader: jest.fn(),
    } as unknown as Response;

    await controller.viewDocument(
      'user-1',
      'documents/user-1/1234-resume.pdf',
      response,
    );

    expect(storageService.getDocStream).toHaveBeenCalledWith(
      'user-1',
      'documents/user-1/1234-resume.pdf',
    );
    expect((response.setHeader as jest.Mock).mock.calls).toEqual([
      ['Content-Type', 'application/pdf'],
      [
        'Content-Disposition',
        'inline; filename="documents/user-1/1234-resume.pdf"',
      ],
    ]);
    expect(pipe).toHaveBeenCalledWith(response);
  });

  it('streams documents for download with attachment disposition', async () => {
    const pipe = jest.fn();
    storageService.getDocStream.mockResolvedValue({ pipe } as any);

    const response = {
      setHeader: jest.fn(),
    } as unknown as Response;

    await controller.downloadDocument(
      'user-1',
      'documents/user-1/1234-resume.pdf',
      response,
    );

    expect((response.setHeader as jest.Mock).mock.calls).toEqual([
      ['Content-Type', 'application/pdf'],
      [
        'Content-Disposition',
        'attachment; filename="documents/user-1/1234-resume.pdf"',
      ],
    ]);
    expect(pipe).toHaveBeenCalledWith(response);
  });

  it('maps missing view/download files to NotFoundException', async () => {
    storageService.getDocStream.mockRejectedValue(new Error('missing'));

    await expect(
      controller.viewDocument(
        'user-1',
        'documents/user-1/missing.pdf',
        { setHeader: jest.fn() } as unknown as Response,
      ),
    ).rejects.toThrow(NotFoundException);

    await expect(
      controller.downloadDocument(
        'user-1',
        'documents/user-1/missing.pdf',
        { setHeader: jest.fn() } as unknown as Response,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes a document when the authenticated user owns it', async () => {
    storageService.deleteDoc.mockResolvedValue();

    const result = await controller.deleteDocument(
      { user: { id: 'user-1' } },
      'user-1',
      'documents/user-1/1234-resume.pdf',
    );

    expect(storageService.deleteDoc).toHaveBeenCalledWith(
      'user-1',
      'documents/user-1/1234-resume.pdf',
    );
    expect(result).toEqual({ message: 'Document deleted successfully' });
  });

  it('rejects deletion attempts for another user', async () => {
    await expect(
      controller.deleteDocument(
        { user: { id: 'user-2' } },
        'user-1',
        'documents/user-1/1234-resume.pdf',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps storage delete failures to NotFoundException', async () => {
    storageService.deleteDoc.mockRejectedValue(new Error('missing'));

    await expect(
      controller.deleteDocument(
        { user: { id: 'user-1' } },
        'user-1',
        'documents/user-1/missing.pdf',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});