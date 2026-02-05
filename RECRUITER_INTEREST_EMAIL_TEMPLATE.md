# Recruiter Interest Email Template

## Email Preview

### Subject Line
```
🎯 [Recruiter Name] from [Company] is interested in your resume!
```

### Email Content

```html
<h1>Someone's Interested! 🎯</h1>
<p>Hi [First Name],</p>

<p>
  <strong>[Recruiter Name]</strong> from <strong>[Company]</strong> 
  has shown interest in your resume <strong>"[Resume Title]"</strong>.
</p>

<p><strong>Their Message:</strong></p>

<blockquote style="border-left: 4px solid #007BFF; padding-left: 16px; margin: 16px 0; color: #333;">
  [Recruiter Message - Line breaks preserved]
</blockquote>

<p>Check your dashboard to see more details and respond to recruiting opportunities.</p>

<p>
  <a href="[Dashboard URL]" 
     style="display: inline-block; padding: 12px 24px; background-color: #007BFF; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
    View in Dashboard
  </a>
</p>

<p>Best regards,<br>ResumeCast Team</p>
```

## Text Email Content

```
Hi [First Name],

[Recruiter Name] from [Company] has shown interest in your resume "[Resume Title]".

Their Message:
[Recruiter Message]

Check your dashboard for more details.

Go to: [Dashboard URL]

Best regards,
ResumeCast Team
```

## Example Email

### Subject
```
🎯 Jane Smith from Tech Corp is interested in your resume!
```

### HTML Rendered View

**Someone's Interested! 🎯**

Hi Jose,

**Jane Smith** from **Tech Corp** has shown interest in your resume **"Senior Software Engineer Resume"**.

**Their Message:**
> We are impressed by your background in full-stack development and your experience with modern cloud technologies. We have an exciting opportunity for a Senior Engineer role that matches your skills perfectly. The role involves working with React, Node.js, and AWS in a fast-paced startup environment.
> 
> Would you be interested in discussing this opportunity further?

Check your dashboard to see more details and respond to recruiting opportunities.

[View in Dashboard](https://resumecast.ai/dashboard)

Best regards,
ResumeCast Team

---

## Dynamic Variables

| Variable | Source | Example |
|----------|--------|---------|
| Recruiter Name | `dto.name` | "Jane Smith" |
| Company | `dto.company` | "Tech Corp" |
| Resume Title | `resume.title` | "Senior Software Engineer Resume" |
| Recruiter Message | `dto.message` | "We are impressed by..." |
| First Name | `user.firstName` | "Jose" |
| Dashboard URL | `FRONTEND_URL + /dashboard` | "https://resumecast.ai/dashboard" |

## Styling Details

- **Header**: h1 with emoji for visual appeal
- **Message Block**: Blockquote with:
  - Left border: 4px solid #007BFF (blue)
  - Padding: 16px
  - Margin: 16px 0
  - Color: #333 (dark gray)
- **Button**: 
  - Background: #007BFF (blue)
  - Padding: 12px 24px
  - Border radius: 5px
  - Text color: white
  - Font weight: bold

## Email Configuration

### SMTP Settings Required

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@resumecast.ai
SMTP_FROM_NAME=ResumeCast
```

### Frontend URL

```env
FRONTEND_URL=https://resumecast.ai
```

## Implementation Source

**File:** `apps/api-service/src/shared/email/email.service.ts`

**Method:** `sendRecruiterInterestEmail()`

**Called from:** `apps/api-service/src/features/resumes/resumes.service.ts` → `createRecruiterInterest()`

## Email Delivery

### Success Path
1. Recruiter submits interest via `/api/resumes/recruiter-interest`
2. Interest is created in database
3. Email service is invoked asynchronously
4. Email is sent to profile owner
5. Response is returned to recruiter

### Failure Handling
- If email fails: Interest is still created (already in DB)
- Error is logged for debugging
- User experience is not affected
- Profile owner can still see interest in dashboard

## Testing Email Sending

### Verify Email Service is Running

```bash
# Check if email service is configured
cat apps/api-service/.env | grep SMTP

# Verify method exists
grep -n "sendRecruiterInterestEmail" apps/api-service/src/shared/email/email.service.ts
```

### Test Email Sending

```typescript
// In your test file:
const emailService = module.get<EmailService>(EmailService);
const sendEmailSpy = jest.spyOn(emailService, 'sendRecruiterInterestEmail');

// ... run test ...

expect(sendEmailSpy).toHaveBeenCalledWith(
  'john@example.com',      // email
  'John',                  // firstName
  'Jane Recruiter',        // recruiterName
  'Tech Corp',            // company
  'Message text',         // message
  'Resume Title'          // resumeTitle
);
```

### Check Email Logs

```bash
# View API service logs
pm2 logs api-service | grep -i email

# View recent email attempts
tail -f /var/log/api-service.log | grep -i "recruiter.*email"
```

## Email Marketing Compliance

### Best Practices

- ✅ Uses profile owner's email (user opted in)
- ✅ Clear unsubscribe option (not required for transactional)
- ✅ Professional branding
- ✅ Clear action item (View in Dashboard)
- ✅ Relevant content (recruiter message)

### GDPR Compliance

- ✅ Only sends to explicitly created user
- ✅ No unsolicited marketing
- ✅ Legitimate business interest
- ✅ Clear sender identification
- ✅ Option to manage in dashboard

## Troubleshooting

### Email Not Received

1. **Check SMTP Configuration**
   ```bash
   echo "SMTP_HOST: $SMTP_HOST"
   echo "SMTP_PORT: $SMTP_PORT"
   ```

2. **Check Email Service Logs**
   ```bash
   pm2 logs api-service | grep -i "recruiter.*email"
   ```

3. **Verify User Email is Correct**
   ```sql
   SELECT email, firstName FROM "User" WHERE id = 'user-id';
   ```

4. **Check Email Spam Folder**
   - May be flagged as spam if SMTP not properly configured
   - Update SPF/DKIM records in DNS

### SMTP Connection Errors

```bash
# Test SMTP connection
telnet smtp.example.com 587

# Or use openssl
openssl s_client -connect smtp.example.com:587 -starttls smtp
```

### Email Formatting Issues

- Test email client rendering: https://litmus.com
- Verify image links are absolute URLs
- Check mobile responsiveness
- Test link clicks in dashboard

## Future Email Enhancements

1. **Email Templates**
   - Use handlebars or EJS templates
   - Centralized template management
   - Easy translations

2. **Email Scheduling**
   - Queue emails with delay
   - Send at optimal time

3. **Email Analytics**
   - Track open rates
   - Track link clicks
   - Monitor bounces

4. **Personalization**
   - Add recruiter profile details
   - Add company logo
   - Add job description link

5. **Templating System**
   - User can customize email templates
   - Brand colors/logos
   - Custom footer
