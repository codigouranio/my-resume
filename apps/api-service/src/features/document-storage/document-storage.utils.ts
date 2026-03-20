import * as path from 'path';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const DOCUMENTS_PREFIX = 'documents';

export function buildDocumentKey(
  userId: string,
  fileName: string,
  timestamp: number = Date.now(),
): string {
  const sanitizedFileName = sanitizeDocumentFileName(fileName);
  return `${DOCUMENTS_PREFIX}/${userId}/${timestamp}-${sanitizedFileName}`;
}

export function sanitizeDocumentFileName(fileName: string): string {
  return path.basename(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');
}

export function normalizeApiBaseUrl(baseUrl?: string): string {
  const normalized = baseUrl || DEFAULT_API_BASE_URL;
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

export function buildDocumentRouteUrl(
  baseUrl: string,
  action: 'view' | 'download',
  userId: string,
  fileKey: string,
): string {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  return `${normalizedBaseUrl}/api/documents/${action}/${encodeURIComponent(userId)}/${encodeURIComponent(fileKey)}`;
}

export function buildDocumentEmbedCode(fileKey: string, viewUrl: string): string {
  const fileExt = path.extname(fileKey).toLowerCase();
  const displayName = path.basename(fileKey);

  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(fileExt)) {
    return `![${displayName}](${viewUrl})`;
  }

  if (fileExt === '.pdf') {
    return `[📄 ${displayName}](${viewUrl})`;
  }

  if (['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(fileExt)) {
    return `[📎 ${displayName}](${viewUrl})`;
  }

  return `[📁 ${displayName}](${viewUrl})`;
}

export function assertDocumentKeyOwnership(userId: string, fileKey: string): void {
  const expectedPrefix = `${DOCUMENTS_PREFIX}/${userId}/`;
  const legacyFsPrefix = `${userId}/`;

  if (!fileKey.startsWith(expectedPrefix) && !fileKey.startsWith(legacyFsPrefix)) {
    throw new Error(`Document key does not belong to user: ${userId}`);
  }
}

export function resolveFsPathFromDocumentKey(
  storageDir: string,
  userId: string,
  fileKey: string,
): string {
  assertDocumentKeyOwnership(userId, fileKey);

  if (fileKey.startsWith(`${DOCUMENTS_PREFIX}/`)) {
    return path.join(storageDir, fileKey.slice(`${DOCUMENTS_PREFIX}/`.length));
  }

  // Legacy FS keys were stored as: userId/timestamp-file.ext
  return path.join(storageDir, fileKey);
}
