# Public Journal Feature

## Overview

Allows users to make their journal posts public and share them via a dedicated public journal page.

## Features

### 1. **Star Reaction** ⭐
- Added STAR as the first reaction type in PostReactions
- Users can give star reactions to journal posts (like favorites/bookmarks)

### 2. **Public Toggle** 🌐
- New `isPublic` checkbox in PostForm
- When enabled, makes the journal post visible on public journal page
- Badge shown on posts marked as public

### 3. **Public Journal Page**
- Route: `/journal/:username`
- Displays all public posts for a given user
- Features:
  - Clean, read-only view of public posts
  - URL linkification (clickable links)
  - Show more/less for long posts (280 char truncation)
  - Reaction counts displayed
  - No edit/delete controls (public view only)

### 4. **Quick Access Link**
- "View Public Journal" button in AI Context Feed header
- Opens user's public journal in new tab
- Uses email prefix as username (e.g., user@example.com → /journal/user)

## Files Created

- `src/features/public-journal/PublicJournalPage.tsx` - Public journal page component
- `src/features/public-journal/index.ts` - Feature export

## Files Modified

- `src/features/ai-context/PostReactions.tsx` - Added STAR reaction
- `src/features/ai-context/PostForm.tsx` - Added isPublic toggle
- `src/features/ai-context/PostCard.tsx` - Added public badge
- `src/features/ai-context/AIContextFeed.tsx` - Added public journal link
- `src/shared/api/client.ts` - Added isPublic parameter support
- `src/App.tsx` - Added route for public journal page

## API Requirements

The backend needs to support:

### POST `/api/ai-context/posts`
```json
{
  "text": "Journal text",
  "publishedAt": "2026-03-07T00:00:00.000Z",
  "includeInAI": true,
  "isPublic": true
}
```

### PUT `/api/ai-context/posts/:id`
```json
{
  "text": "Updated text",
  "publishedAt": "2026-03-07T00:00:00.000Z",
  "includeInAI": true,
  "isPublic": true
}
```

### GET `/api/ai-context/public/:username`
Returns public posts for a specific user (no auth required)
Query params: `limit`, `offset`

## Usage

1. **Creating a public post:**
   - Go to Dashboard → Journal AI Context
   - Click "New Journal Entry"
   - Write your post
   - Check "🌐 Make Public" checkbox
   - Submit

2. **Viewing public journal:**
   - Click "🌐 View Public Journal" in the feed header
   - Or navigate to `/journal/[username]`

3. **Adding star reactions:**
   - Click the ⭐ emoji in the reactions section
   - Star count displays on the post

## Security Notes

- Public posts are accessible without authentication
- Only posts with `isPublic: true` are visible on public page
- Edit/delete buttons only shown on private dashboard view
- File attachments in public posts should also be accessible
