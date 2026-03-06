# Quick Test: File Attachments in AI Context

## Prerequisites

1. Backend running: `cd apps/api-service && npm run start:dev`
2. Frontend running: `cd apps/my-resume && yarn dev`
3. User logged in to the application
4. Environment variable set: `DOCUMENT_STORAGE_TYPE=fs` (or `s3`/`mock`)

## Test Scenario 1: Upload Image to New Post

1. Navigate to Dashboard → AI Context tab
2. Click "✍️ New Journal Entry" button
3. Type some text (e.g., "Here's a screenshot of my latest project")
4. Click "📁 Add File" button
5. Select an image file (PNG, JPG, etc.)
6. **Expected**: Progress indicator appears, then file appears in attachment list with filename and size
7. Click "Save Entry"
8. **Expected**: Post appears with image displayed inline

## Test Scenario 2: Upload PDF to New Post

1. Click "✍️ New Journal Entry"
2. Type text (e.g., "My certification document")
3. Click "📁 Add File"
4. Select a PDF file
5. **Expected**: File appears with 📄 icon
6. Click "Save Entry"
7. **Expected**: Post appears with PDF as clickable link
8. Click the PDF link
9. **Expected**: PDF opens in new browser tab

## Test Scenario 3: Multiple Attachments

1. Create new post
2. Add text
3. Upload image file
4. Upload PDF file
5. Upload text document
6. **Expected**: All 3 files shown in attachment list
7. Save post
8. **Expected**: All 3 attachments display correctly on the post

## Test Scenario 4: Remove Attachment Before Save

1. Create new post
2. Add text and upload file
3. **Before saving**, click "✕" button on attachment
4. **Expected**: Attachment removed from list
5. Save post
6. **Expected**: Post saved without attachment

## Test Scenario 5: Add Attachment to Existing Post

1. Find existing post and click "✏️ Edit"
2. Click "📁 Add File"
3. Select a file
4. **Expected**: File uploads immediately and post updates
5. Post automatically refreshes with new attachment visible
6. Click "Cancel" to exit edit mode
7. **Expected**: Attachment still there (already saved)

## Test Scenario 6: Remove Attachment from Saved Post

1. Edit post that has attachments
2. Click "✕" on an attachment
3. **Expected**: Attachment removed immediately (no need to save)
4. Click "Cancel"
5. Refresh page
6. **Expected**: Attachment still gone (was deleted, not just hidden)

## Test Scenario 7: File Size Limit

1. Create new post
2. Try to upload a file > 10MB
3. **Expected**: Error message "File size must be less than 10MB"
4. Try file < 10MB
5. **Expected**: Uploads successfully

## Test Scenario 8: File Types

Test these file types individually:
- ✅ PNG image → displays inline
- ✅ JPG image → displays inline
- ✅ GIF image → displays inline
- ✅ PDF document → link with 📄 icon
- ✅ TXT file → link with 📝 icon
- ✅ Markdown file → link with 📝 icon
- ✅ Any other type → link with 📎 icon

## Verification Checklist

After each test, verify:
- [ ] File uploaded successfully (no errors)
- [ ] Attachment appears in UI correctly
- [ ] Post saves/updates without errors
- [ ] Attachment persists after page refresh
- [ ] File can be viewed/downloaded via link
- [ ] File removal works correctly
- [ ] No console errors in browser devtools

## API Endpoint Tests

### 1. Upload Document
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/test.pdf"
```

Expected response:
```json
{
  "fileKey": "documents/user-id/1234567890-test.pdf",
  "embedCode": "[📄 test.pdf](http://localhost:3000/api/documents/view/...)",
  "viewUrl": "http://localhost:3000/api/documents/view/user-id/...",
  "downloadUrl": "http://localhost:3000/api/documents/download/user-id/..."
}
```

### 2. Add Attachment to Post
```bash
curl -X POST http://localhost:3000/api/ai-context/posts/POST_ID/attachments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileUrl": "URL_FROM_UPLOAD",
    "fileName": "test.pdf",
    "fileType": "application/pdf",
    "fileSizeBytes": 12345
  }'
```

### 3. Get Post with Attachments
```bash
curl http://localhost:3000/api/ai-context/posts/POST_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response includes:
```json
{
  "id": "...",
  "text": "...",
  "attachments": [
    {
      "id": "...",
      "fileName": "test.pdf",
      "fileType": "application/pdf",
      "fileUrl": "...",
      "fileSizeBytes": 12345
    }
  ]
}
```

### 4. Delete Attachment
```bash
curl -X DELETE http://localhost:3000/api/ai-context/posts/POST_ID/attachments/ATTACHMENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "success": true
}
```

## Troubleshooting

### File Upload Fails
- Check backend logs for errors
- Verify JWT token is valid
- Check document storage configuration (DOCUMENT_STORAGE_TYPE env var)
- For S3: verify AWS credentials
- For FS: verify FS_STORAGE_DIR exists and is writable

### Attachment Not Displaying
- Check browser console for errors
- Verify attachment was saved (check database)
- Check fileUrl is accessible
- For images: verify MIME type is correct

### File Too Large Error
- Check file size (must be < 10MB)
- Check backend max body size settings

### Attachment Removed But Still Shows
- Hard refresh browser (Ctrl+Shift+R)
- Check backend logs to verify deletion
- Check database to confirm removal

## Database Verification

Check attachments in database:
```sql
-- List all attachments
SELECT * FROM "JournalPostAttachment";

-- Count attachments per post
SELECT "postId", COUNT(*) as attachment_count
FROM "JournalPostAttachment"
GROUP BY "postId";

-- Find specific attachment
SELECT * FROM "JournalPostAttachment"
WHERE "fileName" LIKE '%test%';
```

## Success Criteria

All tests pass if:
1. Files upload without errors
2. Attachments display correctly based on type
3. Multiple attachments work
4. Removal works (both draft and saved)
5. File size limit enforced
6. Attachments persist after refresh
7. Links open files correctly
8. No console errors
9. No memory leaks (check browser task manager)
10. Works in incognito/private mode (auth works)
