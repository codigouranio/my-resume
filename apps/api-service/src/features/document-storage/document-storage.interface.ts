import { Readable } from 'stream';

/**
 * Document storage service interface.
 * Supports multiple storage backends (S3, filesystem, mock).
 */
export interface IDocumentStorageService {
  /**
   * Save a document to storage.
   * @param userId - Owner of the document
   * @param fileName - Original filename
   * @param content - File content as Buffer or stream
   * @param mimeType - MIME type of the file
   * @returns Promise resolving to the stored file path/key
   */
  saveDoc(
    userId: string,
    fileName: string,
    content: Buffer | Readable,
    mimeType: string,
  ): Promise<string>;

  /**
   * Get HTML embedded code for including in resume markdown.
   * @param userId - Owner of the document
   * @param fileName - Stored filename/key
   * @returns HTML embed code string
   */
  getDocHtmlEmbeddedCode(userId: string, fileName: string): string;

  /**
   * Get a URL for viewing the file in the browser.
   * @param userId - Owner of the document
   * @param fileName - Stored filename/key
   * @returns Viewing URL
   */
  getDocLinkForViewing(userId: string, fileName: string): string;

  /**
   * Get a URL for downloading the file.
   * @param userId - Owner of the document
   * @param fileName - Stored filename/key
   * @returns Download URL
   */
  getDocLinkForDownloading(userId: string, fileName: string): string;

  /**
   * Delete a document from storage.
   * @param userId - Owner of the document
   * @param fileName - Stored filename/key
   */
  deleteDoc(userId: string, fileName: string): Promise<void>;

  /**
   * Get file stream for downloading.
   * @param userId - Owner of the document
   * @param fileName - Stored filename/key
   * @returns File stream
   */
  getDocStream(userId: string, fileName: string): Promise<Readable>;
}
