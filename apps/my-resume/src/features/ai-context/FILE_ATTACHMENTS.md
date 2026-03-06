# AI Context File Attachments Feature

## Overview

Users can now attach files (images, PDFs, documents) to journal posts in the AI Context feature. Files are stored using the document-storage service and displayed inline or as download links.

## Features

### Upload Files
- **Location**: PostForm component (create/edit journal entries)
- **File Types**: Images (png, jpg, gif, svg), PDFs, Documents (doc, docx, txt, md)
- **Size Limit**: 10MB per file
- **Storage**: Configurable backend (S3, filesystem, or mock)

### Display Attachments
- **Images**: Displayed inline with max-height 64px (256px in pixels)
- **PDFs**: Link with 📄 icon
- **Documents**: Link with 📝 icon  
- **Other files**: Link with 📎 icon
- **Location**: PostCard component shows all attachments

### Remove Attachments
- **From draft**: Remove before saving (local state only)
- **From saved post**: Remove immediately from backend via API

## User Flow

### Creating a Post with Attachments

1. Click "New Journal Entry" button
2. Write entry text
3. Click "📁 Add File" button
4. Select file from computer
5. File uploads to document storage (progress indicator shown)
6. Attachment appears in list with file name and size
7. Click "Save Entry" - post is created, then attachments are linked
8. Post displays with attachments visible

### Editing a Post and Adding Attachments

1. Click "✏️ Edit" on existing post
2. Click "📁 Add File" button
3. Select file from computer
4. File uploads immediately to document storage
5. Attachment is linked to post immediately (no need to save)
6. Post updates automatically with new attachment

### Removing Attachments

1. In edit mode, click "✕" button on attachment
2. If post is saved: removes from backend immediately
3. If post is draft: removes from local state only
4. Confirmation not required (can undo by canceling edit)

## Technical Implementation

### Frontend Components

**PostForm.tsx** - File upload UI
- State: `attachments[]`, `isUploading`, `uploadProgress`
- `handleFileSelect()` - Uploads file to document storage
- `handleRemoveAttachment()` - Removes attachment from post
- UI: File input button, attachment list with remove buttons

**PostCard.tsx** - Display attachments
- Already implemented (was waiting for upload feature)
- Shows images inline, documents as download links
- Differentiates file types with icons

**apiClient.ts** - API methods
- `uploadDocument(file)` - Uploads to document storage service
- `addAIContextAttachment()` - Links attachment to journal post
- `removeAIContextAttachment()` - Unlinks attachment from post
- `deleteDocument()` - Deletes file from storage (currently unused)

### Backend APIs

**Document Storage** (`/api/documents`)
- `POST /upload` - Upload file, returns fileKey, viewUrl, downloadUrl
- `GET /view/:userId/:fileName` - Serve file for viewing
- `GET /download/:userId/:fileName` - Serve file for download
- `DELETE /:userId/:fileName` - Delete file from storage

**AI Context Attachments** (`/api/ai-context/posts/:postId/attachments`)
- `POST /` - Add attachment to post (params: fileUrl, fileName, fileType, fileSizeBytes)
- `DELETE /:attachmentId` - Remove attachment from post

### Database Schema

**JournalPostAttachment** table:
```prisma
model JournalPostAttachment {
  id            String        @id @default(cuid())
  postId        String
  fileUrl       String        // URL from document storage
  fileName      String        // Original filename
  fileType      String        // MIME type
  fileSizeBytes Int?          // Optional file size
  createdAt     DateTime      @default(now())
  
  post          JournalPost   @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  @@index([postId])
}
```

## Configuration

Set document storage type via environment variable:

```bash
# Development (filesystem)
DOCUMENT_STORAGE_TYPE=fs
FS_STORAGE_DIR=/path/to/uploads/documents
API_BASE_URL=http://localhost:3000

# Production (S3)
DOCUMENT_STORAGE_TYPE=s3
AWS_S3_BUCKET_NAME=my-resume-documents
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Testing (mock in-memory)
DOCUMENT_STORAGE_TYPE=mock
```

## File Flow Diagram

```
User Action          Frontend                Backend (Document)    Backend (AI Context)
-----------          --------                ------------------    --------------------
Select File    →    PostForm.tsx
                    handleFileSelect()
                    
Upload File    →    apiClient.uploadDocument()   →   POST /api/documents/upload
                                                      - Save to S3/FS/Mock
                                                      
                                             ←   {fileKey, viewUrl, ...}
                                             
Add to State   ←    setAttachments([...])
                    
Save Post      →    apiClient.createAIContextPost()  →  POST /ai-context/posts
                                                         - Create journal post
                                                         
                                                    ←   {id, ...}
                                                    
Link Files     →    apiClient.addAIContextAttachment()  →  POST /ai-context/posts/{id}/attachments
                    (for each attachment)                   - Create JournalPostAttachment record
                                                            
Display        ←    PostCard.tsx
                    - Show images inline
                    - Show docs as links
```

## Testing

### Manual Testing Steps

1. **Upload Image**
   - Create new post
   - Add PNG/JPG file
   - Verify image displays inline after save
   - Check file appears in viewUrl

2. **Upload PDF**
   - Create new post
   - Add PDF file
   - Verify link appears with 📄 icon
   - Click link, verify PDF opens in new tab

3. **Upload Document**
   - Create new post
   - Add .txt or .md file
   - Verify link appears with 📝 icon

4. **Multiple Attachments**
   - Create post with 3 files
   - Verify all display correctly

5. **Remove Attachment (Draft)**
   - Start new post
   - Add file
   - Remove file before saving
   - Save post
   - Verify no attachment on saved post

6. **Remove Attachment (Saved)**
   - Edit existing post with attachment
   - Remove attachment
   - Verify attachment removed immediately
   - Refresh page, verify still removed

7. **Size Limit**
   - Try uploading 15MB file
   - Verify error message "File size must be less than 10MB"

8. **Edit Post with Existing Attachments**
   - Edit post that has attachments
   - Verify existing attachments shown
   - Add new attachment
   - Verify both old and new attachments display

### API Testing

```bash
# 1. Upload document
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@test.pdf"
  
# Response: { fileKey, viewUrl, downloadUrl, embedCode }

# 2. Add attachment to post
curl -X POST http://localhost:3000/api/ai-context/posts/{postId}/attachments \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"fileUrl":"URL_FROM_STEP_1","fileName":"test.pdf","fileType":"application/pdf","fileSizeBytes":12345}'

# 3. Get post with attachments
curl http://localhost:3000/api/ai-context/posts/{postId} \
  -H "Authorization: Bearer YOUR_JWT"

# 4. Remove attachment
curl -X DELETE http://localhost:3000/api/ai-context/posts/{postId}/attachments/{attachmentId} \
  -H "Authorization: Bearer YOUR_JWT"
```

## Known Limitations

1. **No drag-and-drop**: File must be selected via button click
2. **One file at a time**: Cannot select multiple files in one action
3. **No file preview before upload**: Uploads immediately on selection
4. **No virus scanning**: Files are uploaded without malware checking
5. **No image optimization**: Images stored at original size/quality
6. **No CDN**: Files served directly from storage backend

## Future Enhancements

- [ ] Drag-and-drop file upload
- [ ] Multiple file selection
- [ ] File preview before upload
- [ ] Image thumbnail generation
- [ ] Video file support
- [ ] Audio file support  
- [ ] File type icons based on extension
- [ ] Download all attachments as ZIP
- [ ] Attachment gallery view for images
- [ ] Embed videos inline
- [ ] OCR text extraction from images/PDFs for AI context

## Security Considerations

- ✅ JWT authentication required for uploads
- ✅ File size limit enforced (10MB)
- ✅ File type filtering (accept attribute on input)
- ✅ User-scoped storage paths (userId in file path)
- ✅ Cascade delete (attachments removed when post deleted)
- ⚠️ No MIME type validation on backend (relies on browser)
- ⚠️ No virus scanning
- ⚠️ No content inspection

## Support

For issues or questions, see:
- [Document Storage README](../../api-service/src/features/document-storage/README.md)
- [AI Context README](./README.md)
