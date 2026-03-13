### File Upload Error Fix

**Issue**: Error when uploading files - "The 'path' argument must be of type string. Received undefined"

**Root Cause**: JWT strategy returns `req.user.id`, but document storage controller was accessing `req.user.userId` (which doesn't exist).

**Files Changed**:
- `document-storage.controller.ts` - Changed `req.user.userId` to `req.user.id` (2 occurrences)

**Fixed Lines**:
1. Line 60: `const userId = req.user.id;` (was `req.user.userId`)
2. Line 171: `if (req.user.id !== userId)` (was `req.user.userId`)

**How to Test**:
1. Restart backend: `cd apps/api-service && npm run start:dev`
2. Login to frontend
3. Go to AI Context → New Journal Entry
4. Click "📁 Add File" and select a file
5. File should upload successfully now

**JWT User Object Structure**:
```typescript
req.user = {
  id: string,      // User ID (from JWT payload.sub)
  email: string,   // User email
  role: string     // User role
}
```

All other controllers (ai-context, analytics) were already using `req.user.id` correctly.
