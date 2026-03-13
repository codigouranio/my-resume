# LinkedIn Resume Import Feature

## Overview

This feature allows users to import their professional information from LinkedIn and automatically generate a resume in ResumeCast.

## How It Works

1. User clicks "Import from LinkedIn" button in dashboard
2. User is redirected to LinkedIn OAuth authorization page
3. User grants permission to access their profile
4. LinkedIn redirects back with authorization code
5. Backend exchanges code for access token
6. Backend fetches user's LinkedIn profile data
7. Profile data is transformed to markdown format
8. New resume is created in ResumeCast
9. User is redirected to editor with the new resume

## Setup Instructions

### 1. Register LinkedIn App

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
2. Click "Create app"
3. Fill in app details:
   - **App name**: ResumeCast (or your app name)
   - **LinkedIn Page**: Select or create a company page
   - **App logo**: Upload your logo
   - **Legal agreement**: Accept terms
4. After creation, go to "Auth" tab
5. Note your **Client ID** and **Client Secret**
6. Add redirect URLs:
   - Development: `http://localhost:3000/api/resumes/import/linkedin/callback`
   - Production: `https://yourdomain.com/api/resumes/import/linkedin/callback`

### 2. Request LinkedIn API Products

1. In your app settings, go to "Products" tab
2. Request access to:
   - **Sign In with LinkedIn using OpenID Connect** (Basic profile access)
   - Optionally: **Marketing Developer Platform** (for detailed profile data)
   
   ⚠️ **Note**: LinkedIn has restricted access to many profile fields. By default, you'll only get:
   - Name (first, last)
   - Email address
   - Profile picture
   
   For detailed experience, education, skills, etc., you may need to:
   - Apply for Marketing Developer Platform (approval required)
   - Use LinkedIn Profile Scraping API (paid service)
   - Ask users to manually export/paste their LinkedIn profile data

### 3. Configure Environment Variables

Add these to your `.env` files:

**Backend (`apps/api-service/.env`):**
```bash
# LinkedIn OAuth Configuration
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/resumes/import/linkedin/callback

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3000
```

**Production:**
```bash
LINKEDIN_CLIENT_ID=your_production_client_id
LINKEDIN_CLIENT_SECRET=your_production_client_secret
LINKEDIN_REDIRECT_URI=https://yourdomain.com/api/resumes/import/linkedin/callback
FRONTEND_URL=https://yourdomain.com
```

### 4. Verify Setup

Check if LinkedIn import is configured:

```bash
curl http://localhost:3000/api/resumes/import/linkedin/status
```

Expected response:
```json
{
  "configured": true,
  "available": true,
  "message": "LinkedIn import is available"
}
```

## Usage

### For End Users

1. Log in to ResumeCast
2. Go to Dashboard
3. Click "🔗 Import from LinkedIn" button
4. Click "Allow" on LinkedIn authorization page
5. Wait for import to complete
6. Edit your new resume in the editor

### API Endpoints

**Initiate OAuth Flow:**
```
GET /api/resumes/import/linkedin/auth
Authorization: Bearer <jwt_token>
```

**OAuth Callback (handled automatically):**
```
GET /api/resumes/import/linkedin/callback?code=...&state=...
```

**Check Configuration Status:**
```
GET /api/resumes/import/linkedin/status
```

## Architecture

### Backend Components

1. **LinkedInApiService** (`linkedin-api.service.ts`)
   - Handles OAuth 2.0 flow
   - Fetches profile data from LinkedIn API
   - Methods:
     - `getAuthorizationUrl(state)`: Generate OAuth URL
     - `getAccessToken(code)`: Exchange code for token
     - `getProfile(token)`: Fetch basic profile
     - `getDetailedProfile(token)`: Fetch detailed profile (limited)

2. **LinkedInParserService** (`linkedin-parser.service.ts`)
   - Transforms LinkedIn profile to markdown
   - Methods:
     - `parseToMarkdown(profile)`: Convert profile to resume markdown
     - `generateSlug(firstName, lastName)`: Create URL-friendly slug
     - `generateTitle(firstName, lastName, headline)`: Create resume title

3. **LinkedInImportController** (`linkedin-import.controller.ts`)
   - Handles HTTP endpoints for OAuth flow
   - Routes:
     - `GET /auth`: Initiate OAuth
     - `GET /callback`: Handle OAuth callback
     - `GET /status`: Check configuration

### Frontend Components

1. **Dashboard Import Button**
   - Location: `apps/my-resume/src/features/dashboard/DashboardPage.tsx`
   - Triggers OAuth flow on click
   - Handles success/error messages after redirect

2. **OAuth Callback Handling**
   - Checks URL params for `linkedin_import` status
   - Shows success/error alert to user
   - Refreshes resume list on success

## Security Considerations

1. **State Parameter**: Used for CSRF protection
   - Random 32-byte hex string
   - Stored temporarily (10 min expiration)
   - Verified on callback

2. **JWT Authentication**: OAuth initiation requires valid JWT token

3. **Token Storage**: Access tokens are used immediately and not stored

4. **HTTPS**: Always use HTTPS in production for OAuth redirects

## Limitations

### LinkedIn API Restrictions

As of 2024-2026, LinkedIn has significantly restricted API access:

**Available with Basic Access:**
- ✅ Name (first, last)
- ✅ Email address
- ✅ Profile picture

**Requires Marketing Developer Platform (approval needed):**
- ❌ Work experience / positions
- ❌ Education history
- ❌ Skills
- ❌ Certifications
- ❌ Languages
- ❌ Recommendations

### Workarounds

If you need detailed profile data:

1. **Manual Export**:
   - Ask users to download their LinkedIn data
   - LinkedIn → Settings → Get a copy of your data
   - Parse the exported JSON/CSV files

2. **Profile URL Scraping**:
   - Ask users for their LinkedIn profile URL
   - Use web scraping (be aware of LinkedIn ToS)
   - Consider paid services like Proxycurl, PhantomBuster

3. **Manual Copy-Paste**:
   - Provide text area for users to paste their profile
   - Use AI (LLM) to parse and structure the pasted text

## Troubleshooting

### "LinkedIn import is not configured"

**Problem**: Missing environment variables

**Solution**:
```bash
# Check if variables are set
echo $LINKEDIN_CLIENT_ID
echo $LINKEDIN_CLIENT_SECRET
echo $LINKEDIN_REDIRECT_URI

# Add to .env file if missing
```

### OAuth Error: "redirect_uri_mismatch"

**Problem**: Redirect URI doesn't match registered URL

**Solution**:
1. Go to LinkedIn Developer Portal
2. Check "Redirect URLs" in Auth settings
3. Ensure exact match: `http://localhost:3000/api/resumes/import/linkedin/callback`
4. Note: URL must exactly match (including http/https, port, path)

### "Failed to fetch LinkedIn profile"

**Problem**: Access token invalid or expired

**Solution**:
- Token might be from different app (development vs production)
- Check that Client ID/Secret match your LinkedIn app
- Verify app has correct API products enabled

### Empty Profile Data

**Problem**: LinkedIn API returns minimal data

**Solution**:
- This is expected due to LinkedIn API limitations
- Apply for Marketing Developer Platform access
- Consider alternative data sources (manual export, scraping)

### State Token Expired

**Problem**: User took too long to authorize on LinkedIn

**Solution**:
- Restart the import process
- State tokens expire after 10 minutes for security

## Future Enhancements

1. **Parse Exported LinkedIn Data**
   - Allow users to upload LinkedIn export JSON
   - Support full profile parsing from export files

2. **Profile URL Scraping**
   - Integrate with profile scraping services
   - Provide alternative when OAuth data is limited

3. **AI-Powered Parsing**
   - Use LLM to parse free-form profile text
   - Extract structured data from unformatted input

4. **Incremental Updates**
   - Allow updating existing resume with new LinkedIn data
   - Merge instead of creating new resume

5. **Custom Field Mapping**
   - Let users map LinkedIn fields to resume sections
   - Customize parsing behavior

## Related Documentation

- [LinkedIn OAuth 2.0 Documentation](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [LinkedIn Profile API](https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api)
- [Resume Editor Documentation](../apps/my-resume/src/features/editor/README.md)
- [API Service Documentation](../apps/api-service/README.md)

## Support

If you encounter issues:

1. Check logs: `pm2 logs api-service`
2. Verify LinkedIn app settings
3. Test OAuth callback URL manually
4. Check browser console for frontend errors
5. Open GitHub issue with details

---

**Last Updated**: March 12, 2026
**Feature Version**: 1.0.0
**Status**: ✅ Implemented, ⚠️ Limited by LinkedIn API
