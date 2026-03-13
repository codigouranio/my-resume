# Recruiter Interest Feature Documentation

## Overview

The Recruiter Interest feature allows recruiters to express interest in a user's resume profile. When a recruiter submits their interest, the profile owner receives an email notification with details about the recruiter and their message.

## API Endpoints

### 1. Submit Recruiter Interest
**POST** `/api/resumes/recruiter-interest`

**Public Endpoint** (No authentication required)

Submit interest in a resume as a recruiter.

**Request Body:**
```json
{
  "resumeSlug": "john-doe",
  "name": "Jane Recruiter",
  "email": "jane@company.com",
  "company": "Tech Corp",
  "message": "We are interested in your profile for a Senior Engineer role."
}
```

**Response:**
```json
{
  "id": "interest-1",
  "resumeId": "resume-1",
  "name": "Jane Recruiter",
  "email": "jane@company.com",
  "company": "Tech Corp",
  "message": "We are interested in your profile for a Senior Engineer role.",
  "isRead": false,
  "isFavorite": false,
  "createdAt": "2026-02-04T22:30:00Z",
  "updatedAt": "2026-02-04T22:30:00Z",
  "deletedAt": null
}
```

**Error Responses:**
- `404 Not Found`: Resume slug doesn't exist or resume is not public/published
- `400 Bad Request`: Invalid input data

---

### 2. Get All Recruiter Interests
**GET** `/api/resumes/recruiter-interest/my-interests`

**Protected Endpoint** (Requires JWT authentication)

Retrieve all recruiter interests for the user's resumes.

**Response:**
```json
[
  {
    "id": "interest-1",
    "resumeId": "resume-1",
    "name": "Jane Recruiter",
    "email": "jane@company.com",
    "company": "Tech Corp",
    "message": "We are interested in your profile...",
    "isRead": false,
    "isFavorite": false,
    "createdAt": "2026-02-04T22:30:00Z",
    "resume": {
      "id": "resume-1",
      "slug": "john-doe",
      "title": "My Resume"
    }
  }
]
```

---

### 3. Mark Interest as Read
**PATCH** `/api/resumes/recruiter-interest/:id/read`

**Protected Endpoint** (Requires JWT authentication)

Mark a recruiter interest as read.

**Response:**
```json
{
  "id": "interest-1",
  "resumeId": "resume-1",
  "name": "Jane Recruiter",
  "email": "jane@company.com",
  "company": "Tech Corp",
  "message": "We are interested...",
  "isRead": true,
  "isFavorite": false,
  "createdAt": "2026-02-04T22:30:00Z",
  "updatedAt": "2026-02-04T22:35:00Z"
}
```

---

### 4. Delete Recruiter Interest
**DELETE** `/api/resumes/recruiter-interest/:id`

**Protected Endpoint** (Requires JWT authentication)

Soft delete a recruiter interest (sets `deletedAt` timestamp).

**Response:**
```json
{
  "id": "interest-1",
  "resumeId": "resume-1",
  "name": "Jane Recruiter",
  "email": "jane@company.com",
  "company": "Tech Corp",
  "message": "We are interested...",
  "isRead": true,
  "isFavorite": false,
  "createdAt": "2026-02-04T22:30:00Z",
  "updatedAt": "2026-02-04T22:35:00Z",
  "deletedAt": "2026-02-04T22:36:00Z"
}
```

---

### 5. Toggle Recruiter Interest Favorite
**PATCH** `/api/resumes/recruiter-interest/:id/favorite`

**Protected Endpoint** (Requires JWT authentication)

Toggle the favorite status of a recruiter interest.

**Response:**
```json
{
  "id": "interest-1",
  "resumeId": "resume-1",
  "name": "Jane Recruiter",
  "email": "jane@company.com",
  "company": "Tech Corp",
  "message": "We are interested...",
  "isRead": false,
  "isFavorite": true,
  "createdAt": "2026-02-04T22:30:00Z",
  "updatedAt": "2026-02-04T22:35:00Z"
}
```

---

## Email Notification

When a recruiter submits interest, the profile owner receives an automated email:

### Email Details

**Subject:** `🎯 {recruiterName} from {company} is interested in your resume!`

**Email Content:**
- Recruiter name and company
- Resume title
- Recruiter's message (formatted as a blockquote)
- Link to view in dashboard
- Call to action: "View in Dashboard"

### Email Service Configuration

The email is sent automatically using the `EmailService`:

```typescript
await this.emailService.sendRecruiterInterestEmail(
  resume.user.email,      // Profile owner's email
  resume.user.firstName,  // Profile owner's first name
  dto.name,              // Recruiter's name
  dto.company,           // Recruiter's company
  dto.message,           // Recruiter's message
  resume.title           // Resume title
);
```

**Email Sending Behavior:**
- If email sending fails, the recruiter interest is still created successfully
- The failure is logged but doesn't prevent the interest submission
- This ensures a better user experience

---

## Database Schema

The `RecruiterInterest` model includes:

```prisma
model RecruiterInterest {
  id        String   @id @default(cuid())
  resumeId  String
  resume    Resume   @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  
  name      String
  email     String   @db.VarChar(255)
  company   String?
  message   String   @db.Text
  
  isRead    Boolean  @default(false)
  isFavorite Boolean @default(false)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime? // Soft delete

  @@index([resumeId])
  @@index([email])
}
```

---

## Unit Tests

Comprehensive unit tests cover:

### `createRecruiterInterest`
- ✅ Successfully create recruiter interest and send email
- ✅ Throw NotFoundException when resume slug doesn't exist
- ✅ Throw NotFoundException when resume is not public
- ✅ Throw NotFoundException when resume is not published
- ✅ Create recruiter interest even if email sending fails
- ✅ Handle empty company field
- ✅ Send email with correct resume information

### `getRecruiterInterests`
- ✅ Retrieve all recruiter interests for a user
- ✅ Return empty array when user has no resumes

### `markInterestAsRead`
- ✅ Mark recruiter interest as read
- ✅ Throw NotFoundException when interest doesn't exist
- ✅ Throw ForbiddenException when user doesn't own the resume

### `deleteInterest`
- ✅ Soft delete recruiter interest
- ✅ Throw ForbiddenException when user doesn't own the resume

### `toggleFavorite`
- ✅ Toggle recruiter interest favorite status
- ✅ Toggle favorite from true to false

**Run Tests:**
```bash
cd apps/api-service
npm test -- resumes.recruiter-interest.spec.ts
```

---

## Testing the Feature Manually

### 1. Submit Recruiter Interest
```bash
curl -X POST http://localhost:3000/api/resumes/recruiter-interest \
  -H "Content-Type: application/json" \
  -d '{
    "resumeSlug": "john-doe",
    "name": "Jane Recruiter",
    "email": "jane@company.com",
    "company": "Tech Corp",
    "message": "We are interested in your profile for a Senior Engineer role."
  }'
```

### 2. Get Recruiter Interests (with JWT token)
```bash
curl -X GET http://localhost:3000/api/resumes/recruiter-interest/my-interests \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Mark as Read
```bash
curl -X PATCH http://localhost:3000/api/resumes/recruiter-interest/{interestId}/read \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Toggle Favorite
```bash
curl -X PATCH http://localhost:3000/api/resumes/recruiter-interest/{interestId}/favorite \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. Delete Interest
```bash
curl -X DELETE http://localhost:3000/api/resumes/recruiter-interest/{interestId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Email Service Integration

### Sending Emails

The `EmailService` handles all email sending:

```typescript
async sendRecruiterInterestEmail(
  email: string,
  firstName: string,
  recruiterName: string,
  company: string,
  message: string,
  resumeTitle: string
): Promise<void>
```

**Parameters:**
- `email`: Profile owner's email address
- `firstName`: Profile owner's first name
- `recruiterName`: Recruiter's name
- `company`: Recruiter's company
- `message`: Recruiter's message
- `resumeTitle`: Title of the resume

### Environment Variables

Configure email sending in `.env`:

```env
# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
FROM_EMAIL=noreply@resumecast.ai
FROM_NAME=ResumeCast

# Frontend URL for email links
FRONTEND_URL=https://resumecast.ai
```

---

## Error Handling

### Common Errors

| Error | Status | Cause |
|-------|--------|-------|
| Resume not found | 404 | Resume slug doesn't exist |
| Resume not available | 404 | Resume is not public or not published |
| Interest not found | 404 | Interest ID doesn't exist |
| Access denied | 403 | User doesn't own the resume |
| Invalid input | 400 | Missing required fields or invalid data |

---

## Best Practices

1. **Always verify resume is public before accepting interest**: The service checks `isPublic` and `isPublished` flags
2. **Handle email failures gracefully**: Interests are created even if email sending fails
3. **Use soft deletes**: Interests are soft-deleted (not permanently removed) for audit trail
4. **Monitor recruiter interest activity**: Track metrics like interests received, read rate, response rate
5. **Implement rate limiting**: Consider adding rate limiting to prevent abuse of the `/recruiter-interest` endpoint

---

## Future Enhancements

- **Email notifications for recruiters**: When profile owner responds to interest
- **Interest analytics**: Track interests by company, date, source
- **Bulk export**: Export all interests to CSV
- **Custom response templates**: Pre-written responses for common replies
- **Integration with calendar**: Suggest meeting scheduling
- **Message threading**: Multi-message conversations with recruiters
- **Response status tracking**: Track if recruiter responded after interest
